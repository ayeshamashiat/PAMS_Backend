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
    const studentId = req.user.id;
    const student = await Student.findById(studentId).populate("supervisor_id");
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Ensure proposal accepted first
    const proposal = await ThesisProposal.findOne({
      student_id: studentId,
    }).sort({ createdAt: -1 });
    const proposalOk =
      proposal &&
      (proposal.status === "PGCApproved" || proposal.status === "Approved");
    if (!proposalOk) {
      return res.status(400).json({
        message: "You cannot submit a thesis until the proposal is accepted.",
      });
    }

    // If there is an existing submission (not rejected/revision), block duplicate
    const existing = await ThesisSubmission.findOne({
      student_id: studentId,
    }).sort({ createdAt: -1 });
    if (
      existing &&
      !["Rejected", "RevisionRequested"].includes(existing.status)
    ) {
      return res
        .status(400)
        .json({ message: "A thesis submission already exists." });
    }

    const { title = proposal?.title, abstract = "" } = req.body;
    const file = req.file;
    const attachment = file ? `/uploads/thesis/${file.filename}` : undefined;

    const doc = await ThesisSubmission.create({
      student_id: studentId,
      supervisor_id: student.supervisor_id,
      title,
      abstract,
      attachment,
      status: "Submitted",
      feedbackHistory: [],
    });

    // Unlock Thesis Upload stage in progress (if you track it)
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

    sendNotification(
      studentId,
      "Thesis submitted and sent to supervisor for review."
    );
    res.json({ message: "Thesis submitted successfully.", thesis: doc });
  } catch (e) {
    console.error("submitThesis error:", e);
    res.status(500).json({ message: e.message });
  }
};

exports.getMyThesis = async (req, res) => {
  try {
    const studentId = req.user.id;
    const thesis = await ThesisSubmission.findOne({ student_id: studentId })
      .populate({
        path: "student_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .populate({
        path: "supervisor_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .sort({ createdAt: -1 });

    res.json({ thesis });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.downloadThesisPDF = async (req, res) => {
  try {
    const thesis = await ThesisSubmission.findById(req.params.id);
    if (!thesis || !thesis.attachment)
      return res.status(404).send("File not found");
    const absolute = path.join(__dirname, "..", thesis.attachment);
    return res.sendFile(absolute);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ---- Faculty (Supervisor) ----
exports.listForSupervisor = async (req, res) => {
  try {
    const facultyId = req.user.faculty_id || req.user.id;
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
    if (!valid.includes(status))
      return res.status(400).json({ message: "Invalid status" });

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
    thesis.feedback = feedback || thesis.feedback;

    if (status !== "Comment") thesis.status = status; // Approved/Rejected/RevisionRequested
    await thesis.save();

    sendNotification(
      thesis.student_id,
      `Supervisor ${status.toLowerCase()} your thesis submission.`
    );
    res.json({ message: "Review saved.", thesis });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ---- PGC ----
exports.pgcList = async (req, res) => {
  try {
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

    // Must be supervisor-approved unless it's a comment
    if (thesis.status !== "Approved" && status !== "Comment") {
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
      // Optional: advance progress to next stage (Predefense)
      await ThesisProgress.updateOne(
        { student: thesis.student_id },
        {
          $addToSet: { unlocked_stages: "Predefense" },
          $set: { current_stage: "Predefense" },
        },
        { upsert: true }
      );
      sendNotification(
        thesis.student_id,
        "Your thesis submission has been approved by PGC."
      );
    } else if (status === "Rejected") {
      thesis.status = "PGCRejected";
      sendNotification(
        thesis.student_id,
        "Your thesis submission has been rejected by PGC."
      );
    }
    await thesis.save();

    res.json({ message: `Thesis ${status.toLowerCase()} by PGC.`, thesis });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
