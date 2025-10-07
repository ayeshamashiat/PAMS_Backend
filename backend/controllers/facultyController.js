const Student = require('../models/student');
const ThesisProposal = require('../models/thesisProposal');
const ThesisProgress = require('../models/thesisProgress');
const SupervisorAssignment = require('../models/supervisorAssignment');
const Faculty = require('../models/faculty');
const User = require('../models/user');
const { sendNotification } = require('../utils/notification');

const getFacultyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const faculty = await Faculty.findOne({ user_id: user._id });
    if (!faculty) return res.status(404).json({ message: "Faculty profile not found" });

    res.status(200).json({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      max_supervision_capacity: faculty.max_supervision_capacity
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

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
      $or: [
        { 
          priority_list: { 
            $elemMatch: { faculty_id: faculty._id, status: "Requested" } 
          }
        }
      ]
    })
    .populate("student_id")
    .lean();

    // Double check only the current priority index is for this faculty
    const filtered = assignments.filter(a =>
      a.priority_list[a.current_priority_index].faculty_id.toString() === faculty._id.toString() &&
      a.priority_list[a.current_priority_index].status === "Requested"
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
    // Find the Faculty document linked to this logged-in user
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(404).json({ message: "Faculty not found" });

    // Now query proposals using the faculty _id
    const proposals = await ThesisProposal.find({ supervisor_id: faculty._id })
      .populate({
        path: 'student_id',
        populate: { path: 'user_id', select: 'first_name last_name email' }
      })
      .populate({
        path: 'supervisor_id',
        populate: { path: 'user_id', select: 'first_name last_name email' }
      });

    res.json(proposals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching proposals' });
  }
};

const ALLOWED_STATUSES = ['Approved', 'Rejected'];

const reviewThesisProposal = async (req, res) => {
  try {
    const { proposalId, feedback = '', status } = req.body;

    if (!proposalId || (!ALLOWED_STATUSES.includes(status) && status !== 'Comment')) {
      return res.status(400).json({ message: 'Invalid payload.' });
    }

    const proposal = await ThesisProposal.findById(proposalId).populate('student_id');
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    // ✅ Get faculty corresponding to logged-in user
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return res.status(403).json({ message: 'Faculty profile not found.' });

    // ✅ Check supervisor
    if (proposal.supervisor_id.toString() !== faculty._id.toString()) {
      return res.status(403).json({ message: 'Not allowed. You are not the assigned supervisor.' });
    }

    // Save feedback into history
    if (!proposal.feedbackHistory) proposal.feedbackHistory = [];
    proposal.feedbackHistory.push({ feedback, status, date: new Date() });

    // Update proposal status only if it's Approve/Reject
    if (status !== 'Comment') {
      proposal.status = status;
      proposal.feedback = feedback; // latest feedback
      await updateThesisProgressAfterDecision(proposal.student_id._id, status);
    }

    await proposal.save();

    const refreshed = await ThesisProposal.findById(proposalId).populate('student_id');
    res.json({ message: 'Proposal reviewed.', proposal: refreshed });

  } catch (error) {
    console.error('reviewThesisProposal error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ---- helper ----
async function updateThesisProgressAfterDecision(studentId, status) {
  // Find or create progress doc
  let progress = await ThesisProgress.findOne({ student: studentId });
  if (!progress) {
    progress = new ThesisProgress({
      student: studentId,
      current_stage: 'Proposal',
      unlocked_stages: ['Enrolled', 'Supervisor Assignment', 'Proposal'],
    });
  }

  // Always keep Proposal stage unlocked once a proposal exists
  ensure(progress.unlocked_stages, 'Proposal');

  if (status === 'Approved') {
    // Supervisor approval → unlock Thesis stage and advance
    ensure(progress.unlocked_stages, 'Thesis');
    progress.current_stage = 'Thesis';

    // Optional: keep a human breadcrumb without schema change
    ensure(progress.unlocked_stages, 'Supervisor Approved');
  } else if (status === 'RevisionRequested') {
    // Stay in Proposal; add breadcrumb
    ensure(progress.unlocked_stages, 'Revision Requested');
  } else if (status === 'Rejected') {
    // Stay in Proposal; add breadcrumb
    ensure(progress.unlocked_stages, 'Supervisor Rejected');
  }

  await progress.save();
}

function ensure(arr, val) {
  if (!arr.includes(val)) arr.push(val);
}


const supervisorRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // "Accepted" | "Rejected"

    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const currentIndex = assignment.current_priority_index;
    const current = assignment.priority_list[currentIndex];

    if (response === "Accepted") {
      current.status = "SupervisorAccepted";
      assignment.overall_status = "Pending"; // waits for PGC
      assignment.accepted_faculty = current.faculty_id;

      // notify PGC or student
      sendNotification(
        assignment.student_id,
        "Your supervisor request was accepted by faculty, waiting for PGC approval."
      );
    } 
    else if (response === "Rejected") {
      current.status = "SupervisorRejected";

      // If there’s another supervisor in the list
      if (currentIndex + 1 < assignment.priority_list.length) {
        assignment.current_priority_index += 1;
        assignment.priority_list[assignment.current_priority_index].status = "Requested";
        assignment.overall_status = "Pending";

        // notify next faculty
        sendNotification(
          assignment.priority_list[assignment.current_priority_index].faculty_id,
          "You have a new supervision request."
        );

        // notify student
        sendNotification(
          assignment.student_id,
          "Your supervisor request was declined, moving to next priority."
        );
      } else {
        // last one rejected → hand over to PGC
        assignment.overall_status = "PGCReview";
        assignment.accepted_faculty = null;

        // notify student + PGC
        sendNotification(
          assignment.student_id,
          "All your priority supervisors declined. Your case is under PGC review for manual assignment."
        );
        sendNotification(
          "PGC_ROLE_OR_USERID", // depends how you identify PGC
          "A student requires manual supervisor assignment."
        );
      }
    }

    await assignment.save();
    res.json(assignment);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating supervision request" });
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
  getAcceptedSupervisionStudents,
  getFacultyProfile
};