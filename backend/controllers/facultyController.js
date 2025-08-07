const Student = require('../models/student');
const ThesisProposal = require('../models/thesisProposal');
const SupervisorAssignment = require('../models/supervisorAssignment');
const Faculty = require('../models/faculty');
const { sendNotification } = require('../utils/notification');

// View supervised students (with thesis info)
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

// View pending supervisor requests (priority list)
const getPendingSupervisorRequests = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    const assignments = await SupervisorAssignment.find({
      supervisor_priority_list: faculty._id,
      current_priority_index: { $gte: 0 },
      status: 'Pending'
    })
    .populate('student_id')
    .lean();

    const filtered = assignments.filter(a =>
      a.supervisor_priority_list[a.current_priority_index].toString() === faculty._id.toString()
    );

    res.json({ requests: filtered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// View supervision quota/load
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

// View thesis proposals from supervised students
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

// Review thesis proposal (give feedback, approve, request revision)
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

// Supervisor respond to request
const supervisorRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // response: 'Accepted' or 'Rejected'
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const idx = assignment.current_priority_index;
    if (assignment.priority_list[idx].status !== 'Requested') {
      return res.status(400).json({ message: 'No pending request for this supervisor.' });
    }

    if (response === 'Accepted') {
      assignment.priority_list[idx].status = 'Accepted';
      assignment.accepted_faculty = assignment.priority_list[idx].faculty_id;
      // Notify PGC for approval
      sendNotification('PGC_USER_ID', 'Supervisor accepted. Awaiting your approval.');
    } else {
      assignment.priority_list[idx].status = 'Rejected';
      assignment.current_priority_index += 1;
      if (assignment.current_priority_index < assignment.priority_list.length) {
        assignment.priority_list[assignment.current_priority_index].status = 'Requested';
        sendNotification(assignment.priority_list[assignment.current_priority_index].faculty_id, 'You have a new supervision request.');
      } else {
        assignment.overall_status = 'Failed';
        sendNotification(assignment.student_id, 'All supervisor requests rejected.');
      }
    }
    await assignment.save();
    res.json({ message: 'Supervisor response recorded.', assignment });
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
  supervisorRespond
};