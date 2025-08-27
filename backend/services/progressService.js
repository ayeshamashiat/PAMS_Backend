// services/progressService.js
const SupervisorAssignment = require('../models/supervisorAssignment');
const ThesisProposal = require('../models/thesisProposal');

async function computeUnlockedStages(student) {
  const creditsOk = student.total_credit_hours >= 9;
  const cgpaOk = student.cgpa > 2.5;

  const supervisorAssignment = await SupervisorAssignment.findOne({ student_id: student._id });
  const supervisorAssigned = supervisorAssignment?.status === 'Assigned';

  const proposal = await ThesisProposal.findOne({ student_id: student._id });
  const proposalApproved = proposal?.status === 'Approved';

  return [
    { step: 'Enrolled', unlocked: true },
    { step: 'Supervisor Assignment', unlocked: creditsOk },
    { step: 'Thesis Proposal', unlocked: creditsOk && cgpaOk && supervisorAssigned },
    { step: 'Thesis Upload', unlocked: creditsOk && cgpaOk && supervisorAssigned && proposalApproved },
    { step: 'Predefense', unlocked: proposalApproved },
    { step: 'Defense', unlocked: proposalApproved }
  ];
}

module.exports = { computeUnlockedStages };
