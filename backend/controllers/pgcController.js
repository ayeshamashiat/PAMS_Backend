const SupervisorAssignment = require("../models/supervisorAssignment");
const ThesisProposal = require("../models/thesisProposal");
const { sendNotification } = require("../utils/notification");
const Student = require("../models/student");
const Faculty = require("../models/faculty");
const StudentCourse = require("../models/studentCourse");
const User = require("../models/user");
const listPGCThesisProposals = async (req, res) => {
  try {
    const statuses = String(req.query.status || "Approved")
      .split(",")
      .map((s) => s.trim());

    const proposals = await ThesisProposal.find({ status: { $in: statuses } })
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
      })
      .sort({ createdAt: -1 });

    res.json({ proposals });
  } catch (error) {
    console.error("PGC list proposals error:", error);
    res.status(500).json({ message: error.message });
  }
};

const pgcRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // response: 'Accepted' or 'Rejected'
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found." });

    const idx = assignment.current_priority_index;
    if (assignment.priority_list[idx].status !== "SupervisorAccepted") {
      return res
        .status(400)
        .json({ message: "Supervisor has not accepted yet." });
    }

    if (response === "Accepted") {
      assignment.priority_list[idx].status = "PGCAccepted";
      assignment.overall_status = "Assigned";
      // Set the accepted faculty
      assignment.accepted_faculty = assignment.priority_list[idx].faculty_id;
      const student = assignment.student_id;
      student.supervisor_id = assignment.accepted_faculty;

      sendNotification(assignment.student_id, "Supervisor assigned!");

      // Update student's supervisor_id
      await Student.findByIdAndUpdate(assignment.student_id, {
        supervisor_id: assignment.priority_list[idx].faculty_id,
      });

      // Increment faculty's current supervision count
      await Faculty.findByIdAndUpdate(
        assignment.priority_list[idx].faculty_id,
        { $inc: { current_supervision_count: 1 } }
      );
    } else {
      assignment.priority_list[idx].status = "PGCRejected";
      assignment.current_priority_index += 1;
      assignment.accepted_faculty = null;
      if (assignment.current_priority_index < assignment.priority_list.length) {
        assignment.priority_list[assignment.current_priority_index].status =
          "Requested";
        sendNotification(
          assignment.priority_list[assignment.current_priority_index]
            .faculty_id,
          "You have a new supervision request."
        );
      } else {
        assignment.overall_status = "Failed";
        sendNotification(
          assignment.student_id,
          "PGC rejected all supervisors. Will assign manually."
        );
      }
    }
    await assignment.save();
    res.json({ message: "PGC response recorded.", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pgcManualAssign = async (req, res) => {
  try {
    const { assignmentId, facultyId } = req.body;
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found." });

    assignment.accepted_faculty = facultyId;
    assignment.overall_status = "Assigned";
    await assignment.save();

    // Update student's supervisor_id
    await Student.findByIdAndUpdate(assignment.student_id, {
      supervisor_id: facultyId,
    });

    // Increment faculty's current supervision count
    await Faculty.findByIdAndUpdate(facultyId, {
      $inc: { current_supervision_count: 1 },
    });

    sendNotification(assignment.student_id, "Supervisor assigned by PGC.");
    res.json({ message: "Supervisor manually assigned by PGC.", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NEW: Get proposals waiting for PGC review (supervisor already approved)
const getPendingProposals = async (req, res) => {
  try {
    // Find proposals that supervisor approved but PGC hasn't reviewed yet
    const proposals = await ThesisProposal.find({
      status: "Approved", // Supervisor approved, waiting for PGC
    })
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
      })
      .sort({ createdAt: -1 }); // Most recent first

    res.json({ proposals });
  } catch (error) {
    console.error("Error fetching pending proposals:", error);
    res.status(500).json({ error: error.message });
  }
};

// NEW: Get PGC approved proposals
const getApprovedProposals = async (req, res) => {
  try {
    // Find proposals that PGC has approved
    const proposals = await ThesisProposal.find({
      status: "PGCApproved",
    })
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
      })
      .sort({ updatedAt: -1 }); // Most recently approved first

    res.json({ proposals });
  } catch (error) {
    console.error("Error fetching approved proposals:", error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATED: Enhanced PGC review proposal function
const pgcReviewProposal = async (req, res) => {
  try {
    const { proposalId, feedback = "", status } = req.body;

    // Validate inputs
    if (!proposalId) {
      return res.status(400).json({ message: "Proposal ID is required." });
    }

    const validStatuses = ["Approved", "Rejected", "Comment"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message:
          "Invalid status. Must be 'Approved', 'Rejected', or 'Comment'.",
      });
    }

    // Find the proposal
    const proposal = await ThesisProposal.findById(proposalId).populate({
      path: "student_id",
      populate: { path: "user_id", select: "first_name last_name email" },
    });

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found." });
    }

    // Check if proposal is in correct state for PGC review
    if (proposal.status !== "Approved" && status !== "Comment") {
      return res.status(400).json({
        message:
          "Proposal must be supervisor-approved before PGC can review it.",
      });
    }

    // Initialize feedback history if it doesn't exist
    if (!proposal.feedbackHistory) {
      proposal.feedbackHistory = [];
    }

    // Add feedback to history
    proposal.feedbackHistory.push({
      feedback,
      status,
      date: new Date(),
      reviewedBy: "pgc",
    });

    // Update proposal status based on PGC decision
    if (status === "Approved") {
      proposal.status = "PGCApproved";
      proposal.feedback = feedback || "Approved by PGC";

      // Send notification to student
      sendNotification(
        proposal.student_id._id,
        "Congratulations! Your thesis proposal has been approved by PGC."
      );

      // Send notification to supervisor
      sendNotification(
        proposal.supervisor_id,
        `Thesis proposal for ${proposal.student_id.user_id.first_name} ${proposal.student_id.user_id.last_name} has been approved by PGC.`
      );
    } else if (status === "Rejected") {
      proposal.status = "PGCRejected";
      proposal.feedback = feedback || "Rejected by PGC";

      // Send notification to student
      sendNotification(
        proposal.student_id._id,
        "Your thesis proposal has been rejected by PGC. Please revise and resubmit."
      );

      // Send notification to supervisor
      sendNotification(
        proposal.supervisor_id,
        `Thesis proposal for ${proposal.student_id.user_id.first_name} ${proposal.student_id.user_id.last_name} has been rejected by PGC.`
      );
    } else if (status === "Comment") {
      // Just add comment, don't change status
      proposal.feedback = feedback;
    }

    await proposal.save();

    // Return updated proposal with populated fields
    const updatedProposal = await ThesisProposal.findById(proposalId)
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

    res.json({
      message: `Proposal ${status.toLowerCase()} successfully.`,
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error("PGC review proposal error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getSupervisorLoadReport = async (req, res) => {
  try {
    const faculties = await Faculty.find().populate(
      "user_id",
      "first_name last_name"
    );

    const report = [];
    for (const faculty of faculties) {
      const supervisedCount = await Student.countDocuments({
        supervisor_id: faculty._id,
      });

      report.push({
        faculty: faculty.user_id
          ? `${faculty.user_id.first_name} ${faculty.user_id.last_name}`
          : "Unknown Faculty",
        current_supervision_count: supervisedCount,
        max_supervision_capacity: faculty.max_supervision_capacity,
        utilization_percentage:
          faculty.max_supervision_capacity > 0
            ? Math.round(
                (supervisedCount / faculty.max_supervision_capacity) * 100
              )
            : 0,
      });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStudentProgressReport = async (req, res) => {
  try {
    const students = await Student.find()
      .populate("user_id", "first_name last_name email")
      .populate("program_id", "program_name");

    const report = [];
    for (const student of students) {
      const courses = await StudentCourse.find({ student_id: student._id });
      const totalCredits = courses.reduce(
        (sum, c) => sum + (c.obtained_credit || 0),
        0
      );

      report.push({
        student_name: student.user_id
          ? `${student.user_id.first_name} ${student.user_id.last_name}`
          : "Unknown Student",
        student_number: student.student_number,
        program: student.program_id?.program_name || "Unknown Program",
        cgpa: student.cgpa,
        totalCredits,
        email: student.user_id?.email,
      });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPGCSupervisionRequests = async (req, res) => {
  try {
    // Find assignments where the current priority supervisor has accepted
    const assignments = await SupervisorAssignment.find({
      $expr: {
        $eq: [
          {
            $arrayElemAt: ["$priority_list.status", "$current_priority_index"],
          },
          "SupervisorAccepted",
        ],
      },
    })
      .populate({
        path: "student_id",
        populate: [
          {
            path: "user_id",
            select: "first_name last_name email",
          },
          {
            path: "program_id",
            select: "program_name degree_type",
          },
        ],
      })
      .populate({
        path: "priority_list.faculty_id",
        populate: {
          path: "user_id",
          select: "first_name last_name email department",
        },
        select:
          "employee_id designation specialization research_interests current_supervision_count max_supervision_capacity",
      });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPGCAssignedSupervisors = async (req, res) => {
  try {
    const assignments = await SupervisorAssignment.find({
      overall_status: "Assigned",
    })
      .populate({
        path: "student_id",
        populate: [
          { path: "user_id", select: "first_name last_name email" },
          { path: "program_id", select: "program_name degree_type" },
        ],
      })
      .populate({
        path: "accepted_faculty",
        populate: {
          path: "user_id",
          select: "first_name last_name email department",
        },
        select:
          "employee_id designation specialization research_interests current_supervision_count max_supervision_capacity",
      });
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPGCProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id; // depends on your protect middleware
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select(
      "first_name last_name email department role created_at"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // optional: enforce role; comment out if you want admins to view too
    if (user.role !== "PGC") {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      department: user.department,
      role: user.role, // "PGC"
      joined_on: user.created_at, // from timestamps option in your User schema
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  pgcRespond,
  pgcManualAssign,
  pgcReviewProposal,
  getPendingProposals,
  getApprovedProposals,
  getStudentProgressReport,
  getSupervisorLoadReport,
  getPGCSupervisionRequests,
  getPGCAssignedSupervisors,
  getPGCProfile,
  listPGCThesisProposals,
};
