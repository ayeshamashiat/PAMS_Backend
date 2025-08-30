const Student = require('../models/student');
const ThesisProposal = require('../models/thesisProposal');
const SupervisorAssignment = require('../models/supervisorAssignment');
const Faculty = require('../models/faculty');
const { sendNotification } = require('../utils/notification');

const getSupervisedStudents = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    const students = await Student.find({ supervisor_id: faculty._id })
      .populate('user_id', 'first_name last_name email')
      .lean();

    for (let student of students) {
      student.thesisProposal = await ThesisProposal.findOne({ student_id: student._id });
    }

    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPendingSupervisorRequests = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    const assignments = await SupervisorAssignment.find({
      [`priority_list.${0}.faculty_id`]: faculty._id, 
      [`priority_list.${0}.status`]: 'Requested'
    })
      .populate('student_id')
      .lean();

    const filtered = assignments.filter(a =>
      a.priority_list[a.current_priority_index].faculty_id.toString() === faculty._id.toString()
    );

    return res.json({ requests: filtered });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getSupervisionQuota = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    res.json({
      max_supervision_capacity: faculty.max_supervision_capacity,
      current_supervision_count: faculty.current_supervision_count,
      remaining_quota: faculty.max_supervision_capacity - faculty.current_supervision_count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProposalsFromSupervisedStudents = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    const proposals = await ThesisProposal.find({ supervisor_id: faculty._id })
      .populate('student_id')
      .lean();

    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reviewThesisProposal = async (req, res) => {
  try {
    const { proposalId, feedback, status } = req.body; // status: 'Approved', 'RevisionRequested', 'Rejected'
    const proposal = await ThesisProposal.findById(proposalId);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    proposal.feedback = feedback;
    proposal.status = status;
    await proposal.save();

    // Optionally, notify student or PGC
    // sendNotification(proposal.student_id, `Your thesis proposal was ${status}.`);

    res.json({ message: 'Proposal reviewed.', proposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const supervisorRespond = async (req, res) => {
  try {
    const userId = req.user.id; // JWT stores User._id
    const faculty = await Faculty.findOne({ user_id: userId });
    if (!faculty) {
      return res.status(403).json({ message: "Faculty record not found for this user." });
    }
    const facultyId = faculty._id;

    const { assignmentId, response } = req.body; // "Accepted" | "Rejected"

    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    const idx = assignment.current_priority_index;
    const current = assignment.priority_list[idx];

    if (!current || String(current.faculty_id) !== String(facultyId)) {
      return res.status(403).json({ message: "You are not authorized to respond to this request." });
    }

    if (current.status !== "Requested") {
      return res.status(400).json({ message: "No pending request for you." });
    }

    if (response === "Accepted") {
      current.status = "SupervisorAccepted";   // ✅ set correctly
      assignment.accepted_faculty = facultyId;
      assignment.overall_status = "Pending";  // optional: mark assignment done

      // Update student supervisor
      await Student.findByIdAndUpdate(assignment.student_id, {
        supervisor_id: facultyId,
      });

      // Increment faculty supervision count
      await Faculty.findByIdAndUpdate(facultyId, {
        $inc: { current_supervision_count: 1 },
      });

    } else if (response === "Rejected") {
      current.status = "SupervisorRejected";   // ✅ set correctly
      assignment.current_priority_index += 1;

      // Move to next priority faculty if any
      if (assignment.current_priority_index < assignment.priority_list.length) {
        assignment.priority_list[assignment.current_priority_index].status = "Requested";
      } else {
        assignment.overall_status = "Failed";
      }
    } else {
      return res.status(400).json({ message: "Invalid response. Must be 'Accepted' or 'Rejected'." });
    }

    await assignment.save();
    return res.json({ message: "Response recorded.", assignment });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};


const getAcceptedSupervisionStudents = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    // Find assignments where this faculty accepted supervision
    const assignments = await SupervisorAssignment.find({
      'priority_list': {
        $elemMatch: {
          faculty_id: faculty._id,
          status: 'SupervisorAccepted'
        }
      }
    });

    const studentIds = assignments.map(a => a.student_id);
    const students = await Student.find({ _id: { $in: studentIds } })
      .populate('user_id', 'first_name last_name email')
      .lean();

    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSupervisedStudents,
  getPendingSupervisorRequests,
  getSupervisionQuota,
  getProposalsFromSupervisedStudents,
  reviewThesisProposal,
  supervisorRespond,
  getAcceptedSupervisionStudents
};