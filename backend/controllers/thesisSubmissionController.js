// controllers/thesisSubmissionController.js
const path = require("path");
const ThesisSubmission = require("../models/thesisSubmission");
const ThesisProposal = require("../models/thesisProposal");
const ThesisProgress = require("../models/thesisProgress");
const Student = require("../models/student");
const { sendNotification } = require("../utils/notification");

// ---- Student ----
exports.submitThesis = async (req, res) => {
  try {
    // Student is always found via JWT's user_id (your protect middleware)
    const student = await Student.findOne({ user_id: req.user._id }).populate(
      "supervisor_id"
    );
    if (!student) return res.status(404).json({ message: "Student not found" });

    const studentId = student._id;
    const supervisorId = student.supervisor_id?._id || student.supervisor_id;

    // must have accepted proposal
    const proposal = await ThesisProposal.findOne({
      student_id: studentId,
    }).sort({ createdAt: -1 });
    const ok =
      proposal &&
      (proposal.status === "Approved" || proposal.status === "PGCApproved");
    if (!ok) {
      return res.status(400).json({
        message: "You cannot submit a thesis until the proposal is accepted.",
      });
    }

    // allow resubmission if Rejected/RevisionRequested/PGCRejected
    const existing = await ThesisSubmission.findOne({
      student_id: studentId,
    }).sort({ createdAt: -1 });
    if (
      existing &&
      !["Rejected", "RevisionRequested", "PGCRejected"].includes(
        existing.status
      )
    ) {
      return res
        .status(400)
        .json({ message: "A thesis submission already exists." });
    }

    const title = (req.body.title || proposal.title || "").trim();
    const abstract = req.body.abstract || "";
    const attachment = req.file ? `/uploads/${req.file.filename}` : undefined;

    const thesis = await ThesisSubmission.create({
      student_id: studentId,
      supervisor_id: supervisorId,
      title,
      abstract,
      attachment,
      status: "Submitted",
      feedbackHistory: [
        {
          status: "Submitted",
          feedback: "Thesis submitted by student",
          reviewedBy: "student",
          date: new Date(),
        },
      ],
    });

    // unlock Thesis Upload stage
    let progress = await ThesisProgress.findOne({ student: studentId });
    if (!progress) {
      progress = await ThesisProgress.create({
        student: studentId,
        current_stage: "Thesis",
        unlocked_stages: ["Thesis Upload"],
      });
    } else {
      if (!progress.unlocked_stages.includes("Thesis Upload")) {
        progress.unlocked_stages.push("Thesis Upload");
      }
      progress.current_stage = "Thesis";
      await progress.save();
    }

    try {
      sendNotification(
        studentId,
        "Thesis submitted and sent to supervisor for review."
      );
    } catch {}

    res.json({ message: "Thesis submitted successfully.", thesis });
  } catch (e) {
    console.error("submitThesis error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};

// ---- Faculty (Supervisor) ----
exports.listForSupervisor = async (req, res) => {
  try {
    // you likely have a Faculty <-> User mapping; adapt if needed
    const facultyId = req.user.faculty_id || req.user._id;
    const items = await ThesisSubmission.find({ supervisor_id: facultyId })
      .sort({ createdAt: -1 })
      .populate({
        path: "student_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      });
    res.json({ submissions: items });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.supervisorReview = async (req, res) => {
  try {
    const { submissionId, status, feedback = "" } = req.body;
    const valid = ["Approved", "Rejected", "RevisionRequested", "Comment"];
    if (!valid.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const thesis = await ThesisSubmission.findById(submissionId);
    if (!thesis)
      return res.status(404).json({ message: "Submission not found" });

    thesis.feedbackHistory = thesis.feedbackHistory || [];
    thesis.feedbackHistory.push({
      feedback,
      status,
      date: new Date(),
      reviewedBy: "supervisor",
    });
    if (status !== "Comment") thesis.status = status;
    thesis.feedback = feedback || thesis.feedback;
    await thesis.save();

    try {
      if (status === "Approved") {
        sendNotification(
          thesis.student_id,
          "Supervisor approved your thesis. Awaiting PGC final approval."
        );
      } else if (status === "Rejected") {
        sendNotification(
          thesis.student_id,
          "Supervisor rejected your thesis. Please review feedback and resubmit."
        );
      } else if (status === "RevisionRequested") {
        sendNotification(
          thesis.student_id,
          "Supervisor requested thesis revisions."
        );
      }
    } catch {}

    res.json({ message: "Review saved.", thesis });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ---- PGC ----
exports.pgcList = async (req, res) => {
  try {
    // Pending PGC list == supervisor Approved
    // Approved by PGC == PGCApproved
    // Rejected by PGC == PGCRejected
    const statuses = String(req.query.status || "Approved")
      .split(",")
      .map((s) => s.trim());
    const items = await ThesisSubmission.find({ status: { $in: statuses } })
      .sort({ createdAt: -1 })
      .populate({
        path: "student_id",
        populate: [
          { path: "user_id", select: "first_name last_name email" },
          { path: "program_id", select: "program_name degree_type" },
        ],
      })
      .populate({
        path: "supervisor_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      });
    res.json({ submissions: items });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.pgcReview = async (req, res) => {
  try {
    const { submissionId, status, feedback = "" } = req.body;
    const valid = ["Approved", "Rejected", "Comment"];
    if (!valid.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const thesis = await ThesisSubmission.findById(submissionId);
    if (!thesis)
      return res.status(404).json({ message: "Submission not found" });

    // PGC can act only after supervisor Approved (except Comment)
    if (status !== "Comment" && thesis.status !== "Approved") {
      return res.status(400).json({
        message: "Submission must be supervisor-approved before PGC review.",
      });
    }

    thesis.feedbackHistory = thesis.feedbackHistory || [];
    thesis.feedbackHistory.push({
      feedback,
      status,
      date: new Date(),
      reviewedBy: "pgc",
    });
    thesis.feedback = feedback || thesis.feedback;

    if (status === "Approved") {
      thesis.status = "PGCApproved";
      // unlock defense scheduling stage
      await ThesisProgress.updateOne(
        { student: thesis.student_id },
        {
          $addToSet: { unlocked_stages: "Defense Scheduling" },
          $set: { current_stage: "Defense Scheduling" },
        },
        { upsert: true }
      );
      try {
        sendNotification(
          thesis.student_id,
          "Your thesis has been approved by PGC."
        );
      } catch {}
    } else if (status === "Rejected") {
      thesis.status = "PGCRejected";
      try {
        sendNotification(
          thesis.student_id,
          "PGC rejected your thesis. Please review feedback and resubmit."
        );
      } catch {}
    }

    await thesis.save();
    res.json({ message: `Thesis ${status.toLowerCase()} by PGC.`, thesis });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// --- add these in thesisSubmissionController.js ---

// Student: view my thesis submission
exports.getMyThesis = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const thesis = await ThesisSubmission.findOne({ student_id: student._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "student_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .populate({
        path: "supervisor_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      });

    // return null if nothing submitted yet (frontend handles it)
    return res.json({ thesis });
  } catch (e) {
    console.error("getMyThesis error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};

// Student: download my thesis PDF
exports.downloadThesisPDF = async (req, res) => {
  try {
    const thesis = await ThesisSubmission.findById(req.params.id);
    if (!thesis || !thesis.attachment) {
      return res.status(404).json({ message: "File not found" });
    }

    // your code saves attachment as "/uploads/<filename>" (leading slash)
    const rel = thesis.attachment.startsWith("/")
      ? thesis.attachment.slice(1)
      : thesis.attachment;

    const absolute = path.join(process.cwd(), rel);
    return res.sendFile(absolute);
  } catch (e) {
    console.error("downloadThesisPDF error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};
