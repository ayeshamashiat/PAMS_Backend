// services/progressService.js
const SupervisorAssignment = require('../models/supervisorAssignment');
const ThesisProposal = require('../models/thesisProposal');

async function computeUnlockedStages(student, hasSupervisor = null) {
  const creditsOk = student.obtained_credits >= 9;
  const cgpaOk = student.cgpa > 2.5;

  let supervisorAssigned = hasSupervisor;
  if (supervisorAssigned === null) {
    const supervisorAssignment = await SupervisorAssignment.findOne({ student_id: student._id });
    supervisorAssigned = supervisorAssignment?.overall_status === 'Assigned';
  }

  const proposal = await ThesisProposal.findOne({ student_id: student._id });
  const proposalApproved = proposal?.status === 'Approved';

  const supervisorStage = creditsOk;
  const proposalStage = creditsOk && cgpaOk && supervisorAssigned;  // ✅ fixed
  const uploadStage = proposalStage && proposalApproved;
  const predefenseStage = uploadStage;   // unlocked after thesis upload
  const defenseStage = predefenseStage;  // unlocked after predefense

  return [
    { step: 'Enrolled', unlocked: true },
    { step: 'Supervisor Assignment', unlocked: supervisorStage },
    { step: 'Thesis Proposal', unlocked: proposalStage },
    { step: 'Thesis Upload', unlocked: uploadStage },
    { step: 'Predefense', unlocked: predefenseStage },
    { step: 'Defense', unlocked: defenseStage }
  ];
}

module.exports = { computeUnlockedStages };
