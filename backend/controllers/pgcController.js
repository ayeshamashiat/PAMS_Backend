const SupervisorAssignment = require('../models/supervisorAssignment');
const { sendNotification } = require('../utils/notification');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const StudentCourse = require('../models/studentCourse');

const pgcRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // response: 'Accepted' or 'Rejected'
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const idx = assignment.current_priority_index;
    if (assignment.priority_list[idx].status !== 'SupervisorAccepted') {
      return res.status(400).json({ message: 'Supervisor has not accepted yet.' });
    }

    if (response === 'Accepted') {
      assignment.priority_list[idx].status = 'PGCAccepted';
      assignment.overall_status = 'Assigned';
      // Set the accepted faculty
      assignment.accepted_faculty = assignment.priority_list[idx].faculty_id;
      const student = assignment.student_id;
      student.supervisor_id = assignment.accepted_faculty;
      
      sendNotification(assignment.student_id, 'Supervisor assigned!');

      // Update student's supervisor_id
      await Student.findByIdAndUpdate(
        assignment.student_id,
        { supervisor_id: assignment.priority_list[idx].faculty_id }
      );

      // Increment faculty's current supervision count
      await Faculty.findByIdAndUpdate(
        assignment.priority_list[idx].faculty_id,
        { $inc: { current_supervision_count: 1 } }
      );
    } else {
      assignment.priority_list[idx].status = 'PGCRejected';
      assignment.current_priority_index += 1;
      assignment.accepted_faculty = null;
      if (assignment.current_priority_index < assignment.priority_list.length) {
        assignment.priority_list[assignment.current_priority_index].status = 'Requested';
        sendNotification(assignment.priority_list[assignment.current_priority_index].faculty_id, 'You have a new supervision request.');
      } else {
        assignment.overall_status = 'Failed';
        sendNotification(assignment.student_id, 'PGC rejected all supervisors. Will assign manually.');
      }
    }
    await assignment.save();
    res.json({ message: 'PGC response recorded.', assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pgcManualAssign = async (req, res) => {
  try {
    const { assignmentId, facultyId } = req.body;
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    assignment.accepted_faculty = facultyId;
    assignment.overall_status = 'Assigned';
    await assignment.save();

    // Update student's supervisor_id
    await Student.findByIdAndUpdate(
      assignment.student_id,
      { supervisor_id: facultyId }
    );

    // Increment faculty's current supervision count
    await Faculty.findByIdAndUpdate(
      facultyId,
      { $inc: { current_supervision_count: 1 } }
    );

    sendNotification(assignment.student_id, 'Supervisor assigned by PGC.');
    res.json({ message: 'Supervisor manually assigned by PGC.', assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pgcReviewProposal = async (req, res) => {
  try {
    const { proposalId, feedback, status } = req.body; // status: 'PGCReviewed', 'Approved', 'Rejected'
    const proposal = await ThesisProposal.findById(proposalId);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    proposal.feedback = feedback;
    proposal.status = status;
    await proposal.save();

    res.json({ message: 'PGC review recorded.', proposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pendingProposals = async (req, res) => {
  try {
    const proposals = await ThesisProposal.find({ status: { $in: ["Submitted", "Under Review"] } })
      .populate("student_id", "student_number email")
      .populate("supervisor_id", "first_name last_name department")
      .lean();

    res.json(proposals);

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

const getSupervisorLoadReport = async (req, res) => {
  try {
    const faculties = await Faculty.find();
    const report = [];
    for (const faculty of faculties) {
      const supervisedCount = await Student.countDocuments({ supervisor_id: faculty._id });
      report.push({
        faculty: faculty.first_name + ' ' + faculty.last_name,
        current_supervision_count: supervisedCount,
        max_supervision_capacity: faculty.max_supervision_capacity
      });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStudentProgressReport = async (req, res) => {
  try {
    const students = await Student.find();
    const report = [];
    for (const student of students) {
      const courses = await StudentCourse.find({ student_id: student._id });
      const totalCredits = courses.reduce((sum, c) => sum + (c.obtained_credit || 0), 0);
      report.push({
        student: student.student_number,
        cgpa: student.cgpa,
        totalCredits
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
          { $arrayElemAt: ["$priority_list.status", "$current_priority_index"] },
          "SupervisorAccepted"
        ]
      }
    })
    .populate({
      path: "student_id",
      populate: [
        {
          path: "user_id",
          select: "first_name last_name email"
        },
        {
          path: "program_id",
          select: "program_name degree_type"
        }
      ]
    })
    .populate({
      path: "priority_list.faculty_id",
      select: "first_name last_name email department research_interests faculty_id current_supervision_count max_supervision_capacity"
    });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPGCAssignedSupervisors = async (req, res) => {
  try {
    const assignments = await SupervisorAssignment.find({ overall_status: "Assigned" })
    .populate({
      path: "student_id",
      populate: [
        { path: "user_id", select: "first_name last_name email" },
        { path: "program_id", select: "program_name degree_type" }
      ]
    })
    .populate({
      path: "accepted_faculty",
      populate: { path: "user_id", select: "first_name last_name email department" },
      select: "employee_id designation specialization research_interests current_supervision_count max_supervision_capacity"
    });
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
    pgcRespond,
    pgcManualAssign,
    pgcReviewProposal,
    getStudentProgressReport,
    getSupervisorLoadReport,
    getPGCSupervisionRequests,
    getPGCAssignedSupervisors,
    pendingProposals
}