const SupervisorAssignment = require("../models/supervisorAssignment");
const ThesisProposal = require("../models/thesisProposal");
const { sendNotification } = require("../utils/notification");
const Student = require("../models/student");
const Faculty = require("../models/faculty");
const StudentCourse = require("../models/studentCourse");
const User = require("../models/user");
const mongoose = require("mongoose");
const ThesisProgress = require("../models/thesisProgress");

const pgcRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // 'Accepted' or 'Rejected'

    const assignment = await SupervisorAssignment.findById(assignmentId)
      .populate("student_id")
      .populate("priority_list.faculty_id");

    if (!assignment)
      return res.status(404).json({ message: "Assignment not found." });

    const idx = assignment.current_priority_index;
    const currentFacultyEntry = assignment.priority_list[idx];

    if (!currentFacultyEntry || currentFacultyEntry.status !== "SupervisorAccepted") {
      return res
        .status(400)
        .json({ message: "Supervisor has not accepted yet or invalid priority index." });
    }

    const studentId = assignment.student_id._id;

    if (response === "Accepted") {
      // ✅ PGC approves supervisor
      assignment.priority_list[idx].status = "PGCAccepted";
      assignment.overall_status = "Assigned";
      assignment.accepted_faculty = currentFacultyEntry.faculty_id;

      // Update student supervisor info
      await Student.findByIdAndUpdate(studentId, {
        supervisor_id: currentFacultyEntry.faculty_id,
      });

      // Increment faculty load
      await Faculty.findByIdAndUpdate(
        currentFacultyEntry.faculty_id,
        { $inc: { current_supervision_count: 1 } }
      );

      // Update or create ThesisProgress
      let progress = await ThesisProgress.findOne({ student: studentId });
      if (!progress) {
        progress = new ThesisProgress({
          student: studentId,
          current_stage: "Supervisor Assignment",
          unlocked_stages: ["Enrolled", "Supervisor Assignment"],
          is_active: true,
        });
      } else {
        await progress.unlockStage("Supervisor Assignment");
      }

      await progress.save();

      sendNotification(studentId, "Your supervisor has been officially assigned by PGC.");
    } else {
      // ❌ PGC rejects supervisor
      assignment.priority_list[idx].status = "PGCRejected";
      assignment.current_priority_index += 1;
      assignment.accepted_faculty = null;

      // Reset thesis progress
      await ThesisProgress.findOneAndUpdate(
        { student: studentId },
        { current_stage: "Enrolled", unlocked_stages: ["Enrolled"] },
        { upsert: true }
      );

      if (assignment.current_priority_index < assignment.priority_list.length) {
        // Move to next faculty
        assignment.priority_list[assignment.current_priority_index].status = "Requested";
        sendNotification(
          assignment.priority_list[assignment.current_priority_index].faculty_id,
          "You have a new supervision request."
        );
      } else {
        // No more faculty left — manual intervention needed
        assignment.overall_status = "PGCReview";
        sendNotification(
          studentId,
          "PGC rejected all supervisor options. You will be assigned manually."
        );
      }
    }

    await assignment.save();
    res.json({ message: "PGC response recorded successfully.", assignment });

  } catch (error) {
    console.error("Error in pgcRespond:", error);
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

const getPGCManualAssign = async (req, res) => {
  try {
    const assignments = await SupervisorAssignment.find({
      overall_status: "PGCReview",
    })
      .populate({
        path: "student_id",
        populate: {
          path: "user_id",
          select: "first_name last_name email department",
        },
      });

    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPGCManualAssignmentsWithSupervisors = async (req, res) => {
  try {
    // Step 1: Get all students waiting for PGC manual assignment
    const assignments = await SupervisorAssignment.find({ overall_status: "PGCReview" })
      .populate({
        path: "student_id",
        populate: [
          { path: "user_id", select: "first_name last_name email department" },
          { path: "program_id", select: "program_name degree_type" },
        ],
      })
      .lean(); // ✅ improves performance since we’ll modify objects later

    // Step 2: For each student, find available supervisors from the same department
    const results = await Promise.all(
      assignments.map(async (assignment) => {
        const student = assignment.student_id;
        if (!student || !student.user_id?.department) {
          return { ...assignment, available_supervisors: [] };
        }

        const studentDept = student.user_id.department;

        // Find available supervisors in the same department
        const supervisors = await Faculty.find({
          $expr: { $gt: ["$max_supervision_capacity", "$current_supervision_count"] },
        })
          .populate({
            path: "user_id",
            select: "first_name last_name email department",
            match: { department: studentDept },
          })
          .lean();

        // Filter out any null user references after population
        const availableSupervisors = supervisors.filter(s => s.user_id !== null);

        return {
          ...assignment,
          available_supervisors: availableSupervisors,
        };
      })
    );

    res.json({ assignments: results });
  } catch (err) {
    console.error("Error fetching PGC manual assignments:", err);
    res.status(500).json({ error: err.message });
  }
};

// NEW: Get proposals waiting for PGC review (supervisor already approved)
const getPendingProposals = async (req, res) => {
  try {
    // Find proposals that supervisor approved but PGC hasn't reviewed yet
    const proposals = await ThesisProposal.find({ 
      status: "Approved" // Supervisor approved, waiting for PGC
    })
    .populate({
      path: 'student_id',
      populate: [
        { path: 'user_id', select: 'first_name last_name email' },
        { path: 'program_id', select: 'program_name degree_type' }
      ]
    })
    .populate({
      path: 'supervisor_id',
      populate: { path: 'user_id', select: 'first_name last_name email' }
    })
    .sort({ createdAt: -1 }); // Most recent first

    res.json({ proposals });
  } catch (error) {
    console.error('Error fetching pending proposals:', error);
    res.status(500).json({ error: error.message });
  }
};

// NEW: Get PGC approved proposals
const getApprovedProposals = async (req, res) => {
  try {
    // Find proposals that PGC has approved
    const proposals = await ThesisProposal.find({ 
      status: "PGCApproved" 
    })
    .populate({
      path: 'student_id',
      populate: [
        { path: 'user_id', select: 'first_name last_name email' },
        { path: 'program_id', select: 'program_name degree_type' }
      ]
    })
    .populate({
      path: 'supervisor_id',
      populate: { path: 'user_id', select: 'first_name last_name email' }
    })
    .sort({ updatedAt: -1 }); // Most recently approved first

    res.json({ proposals });
  } catch (error) {
    console.error('Error fetching approved proposals:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATED: Enhanced PGC review proposal function
const pgcReviewProposal = async (req, res) => {
  try {
    const { proposalId, feedback = '', status } = req.body;

    // Validate inputs
    if (!proposalId) {
      return res.status(400).json({ message: "Proposal ID is required." });
    }

    const validStatuses = ['Approved', 'Rejected', 'Comment'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'Approved', 'Rejected', or 'Comment'." });
    }

    // Find the proposal
    const proposal = await ThesisProposal.findById(proposalId)
      .populate({
        path: 'student_id',
        populate: { path: 'user_id', select: 'first_name last_name email' }
      });

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found." });
    }

    // Check if proposal is in correct state for PGC review
    if (proposal.status !== "Approved" && status !== 'Comment') {
      return res.status(400).json({ 
        message: "Proposal must be supervisor-approved before PGC can review it." 
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
      reviewedBy: 'pgc'
    });

    // Update proposal status based on PGC decision
    if (status === 'Approved') {
      proposal.status = 'PGCApproved';
      proposal.feedback = feedback || 'Approved by PGC';
      
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

    } else if (status === 'Rejected') {
      proposal.status = 'PGCRejected';
      proposal.feedback = feedback || 'Rejected by PGC';
      
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

    } else if (status === 'Comment') {
      // Just add comment, don't change status
      proposal.feedback = feedback;
    }

    await proposal.save();

    // Return updated proposal with populated fields
    const updatedProposal = await ThesisProposal.findById(proposalId)
      .populate({
        path: 'student_id',
        populate: [
          { path: 'user_id', select: 'first_name last_name email' },
          { path: 'program_id', select: 'program_name degree_type' }
        ]
      })
      .populate({
        path: 'supervisor_id',
        populate: { path: 'user_id', select: 'first_name last_name email' }
      });

    res.json({ 
      message: `Proposal ${status.toLowerCase()} successfully.`, 
      proposal: updatedProposal 
    });

  } catch (error) {
    console.error('PGC review proposal error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getPGCSupervisionRequests = async (req, res) => {
  try {
    const assignments = await SupervisorAssignment.find({
      $expr: {
        $eq: [
          { $arrayElemAt: ["$priority_list.status", "$current_priority_index"] },
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
          select: "first_name last_name email department"
        },
        select: "employee_id designation specialization research_interests current_supervision_count max_supervision_capacity",
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

const getAvailableSupervisors = async (req, res) => {
  try {
    const { studentId } = req.query; // 👈 ensure frontend sends this
    if (!studentId)
      return res.status(400).json({ message: "Student ID is required" });

    // Verify student exists in manual assignment (PGCReview)
    const assignment = await SupervisorAssignment.findOne({
      student_id: new mongoose.Types.ObjectId(studentId),
      overall_status: "PGCReview",
    });
    if (!assignment)
      return res.status(404).json({
        message: "No PGCReview assignment found for this student",
      });

    // Get student + department
    const student = await Student.findById(studentId).populate(
      "user_id",
      "department"
    );
    if (!student)
      return res.status(404).json({ message: "Student not found" });

    const studentDept = student.user_id?.department;
    if (!studentDept)
      return res
        .status(400)
        .json({ message: "Student department not found" });

    // Get available supervisors in same department
    const faculties = await Faculty.find({
      $expr: { $lt: ["$current_supervision_count", "$max_supervision_capacity"] },
    })
      .populate({
        path: "user_id",
        match: { department: studentDept },
        select: "first_name last_name email department",
      })
      .lean();

    const filtered = faculties.filter((f) => f.user_id !== null);

    res.json({ supervisors: filtered });
  } catch (err) {
    console.error("Error in getAvailableSupervisors:", err);
    res.status(500).json({ error: err.message });
  }
};

const assignSupervisorManually = async (req, res) => {
  try {
    const { studentId, supervisorId } = req.body;

    if (!studentId || !supervisorId)
      return res.status(400).json({ message: "Student ID and Supervisor ID are required." });

    // Find or create supervisor assignment entry
    let assignment = await SupervisorAssignment.findOne({ student_id: studentId });

    if (!assignment) {
      assignment = new SupervisorAssignment({
        student_id: studentId,
        priority_list: [],
        overall_status: "PGCReview",
      });
    }

    // Update the assignment directly
    assignment.priority_list.push({
      faculty_id: supervisorId,
      status: "PGCAccepted",
    });
    assignment.accepted_faculty = supervisorId;
    assignment.overall_status = "Assigned";

    // Update student supervisor info
    await Student.findByIdAndUpdate(studentId, { supervisor_id: supervisorId });

    // Increment faculty’s supervision count
    await Faculty.findByIdAndUpdate(supervisorId, {
      $inc: { current_supervision_count: 1 },
    });

    // Create or update thesis progress
    let progress = await ThesisProgress.findOne({ student: studentId });
    if (!progress) {
      progress = new ThesisProgress({
        student: studentId,
        current_stage: "Supervisor Assignment",
        unlocked_stages: ["Enrolled", "Supervisor Assignment"],
        is_active: true,
      });
    } else {
      await progress.unlockStage("Supervisor Assignment");
    }

    await progress.save();
    await assignment.save();

    sendNotification(studentId, "PGC has manually assigned your supervisor.");
    sendNotification(supervisorId, "You have been assigned a new supervisee by PGC.");

    res.json({
      message: "Supervisor assigned successfully by PGC.",
      assignment,
    });
  } catch (error) {
    console.error("Error in assignSupervisor:", error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  pgcRespond,
  pgcManualAssign,
  pgcReviewProposal,
  getPendingProposals,
  getApprovedProposals,
  getPGCSupervisionRequests,
  getPGCAssignedSupervisors,
  getPGCProfile,
  getPGCManualAssign,
  getAvailableSupervisors,
  assignSupervisorManually,
  getPGCManualAssignmentsWithSupervisors
};