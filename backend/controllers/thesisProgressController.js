// controllers/thesisProgressController.js
const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');
const ThesisProposal = require('../models/thesisProposal');
const SupervisorAssignment = require('../models/supervisorAssignment');

const stageLabels = {
  Proposal: 'Thesis Proposal',
  Thesis: 'Thesis Upload',
  Predefense: 'Predefense',
  Defense: 'Defense',
  'Supervisor Assignment': 'Supervisor Assignment',
  Enrolled: 'Enrolled',
};

/**
 * Helper: determine if a student has an assigned supervisor
 * Conditions:
 *  - student.supervisor_id is set  OR
 *  - a SupervisorAssignment exists whose overall_status is "Assigned" OR
 *    priority_list contains a PGC-approved choice (PGCAccepted)
 */
async function hasAssignedSupervisor(studentId, directSupervisorId) {
  if (directSupervisorId) return true;

  const assignment = await SupervisorAssignment.findOne({ student_id: studentId }).lean();
  if (!assignment) return false;

  if (assignment.overall_status === 'Assigned') return true;

  const pgcAccepted = (assignment.priority_list || []).some(
    (p) => p.status === 'PGCAccepted'
  );
  return pgcAccepted;
}

/**
 * Build a normalized progress array in a consistent order
 */
function buildProgress({ hasSupervisor, isEligibleForProposal }) {
  return [
    {
      step: 'Supervisor Assignment',
      unlocked: !!hasSupervisor,
    },
    {
      step: 'Thesis Proposal',
      unlocked: !!isEligibleForProposal,
    },
    {
      step: 'Proposal Upload',
      unlocked: false, // Placeholder – unlock when you add upload logic
    },
    {
      step: 'Thesis Upload',
      unlocked: false, // Placeholder – unlock upon supervisor/PGC approvals
    },
    {
      step: 'Predefense',
      unlocked: false,
    },
    {
      step: 'Defense',
      unlocked: false,
    },
  ];
}

/**
 * GET /api/thesis-progress/check
 * More detailed eligibility endpoint (if you use this route)
 */
const checkProgressEligibility = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ eligible: false, reason: 'Unauthorized', progress: [] });
    }

    // Fetch student (populate single supervisor, your schema has supervisor_id)
    const student = await Student.findOne({ user_id: userId }).populate('supervisor_id');
    if (!student) {
      return res
        .status(404)
        .json({ eligible: false, reason: 'Student not found.', progress: [] });
    }

    // Determine supervisor assignment
    const hasSupervisor = await hasAssignedSupervisor(student._id, student.supervisor_id);

    // Eligibility rules
    const earnedCredits = Number(student.obtained_credits || 0);
    const cgpa = Number(student.cgpa || 0);
    const hasMinCGPA = cgpa >= 2.5;
    const hasMinCredits = earnedCredits >= 9;
    const isEligible = hasMinCGPA && hasMinCredits && hasSupervisor;

    // Reason message (first unmet reason reported)
    let reason = '';
    if (!hasMinCredits) reason = 'Need at least 9 completed credits.';
    else if (!hasMinCGPA) reason = 'CGPA must be at least 2.5.';
    else if (!hasSupervisor) reason = 'No supervisor assigned yet.';

    // Build progress
    const progress = buildProgress({
      hasSupervisor,
      isEligibleForProposal: isEligible,
    });

    // Create or update ThesisProgress doc (optional bookkeeping)
    let thesisProgress = await ThesisProgress.findOne({ student: student._id });
    if (!thesisProgress) {
      thesisProgress = await ThesisProgress.create({
        student: student._id,
        current_stage: 'Enrolled',
        unlocked_stages: progress.filter((p) => p.unlocked).map((p) => p.step),
      });
    } else {
      thesisProgress.unlocked_stages = progress.filter((p) => p.unlocked).map((p) => p.step);
      // Advance current stage if needed
      if (isEligible && thesisProgress.current_stage === 'Enrolled') {
        thesisProgress.current_stage = 'Proposal';
      }
      await thesisProgress.save();
    }

    return res.status(200).json({
      eligible: isEligible,
      reason: isEligible ? '' : reason,
      progress,
      currentStage: thesisProgress.current_stage,
    });
  } catch (err) {
    console.error('Eligibility check error:', err);
    return res.status(500).json({ eligible: false, reason: 'Server error.', progress: [] });
  }
};

/**
 * GET /api/students/progress
 * This one is used by your ThesisPage front-end.
 * Responds with:
 *  - isEligible (same rule as above)
 *  - message
 *  - progress array
 *  - studentInfo snapshot
 */
const getThesisProgress = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        isEligible: false,
        message: 'Unauthorized.',
        progress: [],
        supervisors: [],
      });
    }

    // Find student and (optionally) supervisor
    const student = await Student.findOne({ user_id: userId }).populate('supervisor_id');
    if (!student) {
      return res.status(404).json({
        isEligible: false,
        message: 'Student not found.',
        progress: [],
        supervisors: [],
      });
    }

    // Determine supervisor assignment
    const hasSupervisor = await hasAssignedSupervisor(student._id, student.supervisor_id);

    // Eligibility rules (must have supervisor)
    const earnedCredits = Number(student.obtained_credits || 0);
    const cgpa = Number(student.cgpa || 0);
    const hasMinCGPA = cgpa >= 2.5;
    const hasMinCredits = earnedCredits >= 9;
    const isEligible = hasMinCGPA && hasMinCredits && hasSupervisor;

    const message = isEligible
      ? 'You meet the requirements for thesis proposal.'
      : 'You are not eligible yet. Complete required steps first.';

    // Normalized progress
    const progress = buildProgress({
      hasSupervisor,
      isEligibleForProposal: isEligible,
    });

    // Student snapshot for the UI
    const studentInfo = {
      cgpa,
      obtained_credits: earnedCredits,
      hasSupervisor,
      supervisorName: hasSupervisor
        ? `${student.supervisor_id?.user_id?.first_name || ''} ${student.supervisor_id?.user_id?.last_name || ''}`.trim()
        : null,
    };

    return res.json({
      isEligible,
      message,
      progress,
      studentInfo,
    });
  } catch (error) {
    console.error('Error in getThesisProgress:', error);
    return res.status(500).json({
      isEligible: false,
      message: 'Server error while fetching progress.',
      progress: [],
      studentInfo: null,
    });
  }
};

module.exports = {
  checkProgressEligibility,
  getThesisProgress,
};
