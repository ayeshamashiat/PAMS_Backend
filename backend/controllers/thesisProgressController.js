const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');
const ThesisProposal = require('../models/thesisProposal');
const { computeUnlockedStages } = require('../services/progressService');

const stageLabels = {
  Proposal: "Thesis Proposal",
  Thesis: "Thesis Upload", 
  Predefense: "Predefense",
  Defense: "Defense",
  "Supervisor Assignment": "Supervisor Assignment",
  Enrolled: "Enrolled",
};

const getThesisProgress = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check eligibility for thesis proposal
    const hasSupervisor = !!student.supervisor_id;
    const hasMinCGPA = student.cgpa > 2.5;
    const hasMinCredits = student.obtained_credits >= 9;
    
    const isEligible = hasMinCGPA && hasMinCredits && hasSupervisor;
    
    let reason = "";
    if (!hasMinCredits) reason = "Need at least 9 credits.";
    else if (!hasMinCGPA) reason = "CGPA must be above 2.5.";
    else if (!hasSupervisor) reason = "No supervisor assigned yet.";

    // Check if proposal already exists
    const existingProposal = await ThesisProposal.findOne({ student_id: student._id });
    
    // Compute unlocked stages
    const unlockedStages = await computeUnlockedStages(student);
    
    // Rename stages for frontend consistency
    const progress = unlockedStages.map((s) => ({
      step: stageLabels[s.step] || s.step,
      unlocked: s.unlocked,
    }));

    // Get or create thesis progress record
    let thesisProgress = await ThesisProgress.findOne({ student: student._id });
    if (!thesisProgress) {
      thesisProgress = await ThesisProgress.create({
        student: student._id,
        current_stage: "Enrolled",
        unlocked_stages: progress.filter((s) => s.unlocked).map((s) => s.step),
      });
    } else {
      thesisProgress.unlocked_stages = progress.filter((s) => s.unlocked).map((s) => s.step);
      await thesisProgress.save();
    }

    res.status(200).json({
      eligible: isEligible,
      reason: reason,
      progress: progress,
      proposalSubmitted: !!existingProposal,
      proposalStatus: existingProposal?.status || null,
      studentInfo: {
        cgpa: student.cgpa,
        credits: student.obtained_credits,
        hasSupervisor: hasSupervisor
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const checkProgressEligibility = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Eligibility checks
    const hasSupervisor = !!student.supervisor_id;
    const hasMinCGPA = student.cgpa > 2.5;
    const hasMinCredits = student.obtained_credits >= 9;
    
    const isEligible = hasMinCGPA && hasMinCredits && hasSupervisor;
    
    let reason = "";
    if (!hasMinCredits) reason = "Need at least 9 credits.";
    else if (!hasMinCGPA) reason = "CGPA must be above 2.5.";
    else if (!hasSupervisor) reason = "No supervisor assigned yet.";

    // Compute unlocked stages
    const unlockedStages = await computeUnlockedStages(student);
    
    // Rename stages for frontend consistency
    const progress = unlockedStages.map((s) => ({
      step: stageLabels[s.step] || s.step,
      unlocked: s.unlocked,
    }));

    // Get or create thesis progress record
    let thesisProgress = await ThesisProgress.findOne({ student: student._id });
    if (!thesisProgress) {
      thesisProgress = await ThesisProgress.create({
        student: student._id,
        current_stage: "Enrolled",
        unlocked_stages: progress.filter((s) => s.unlocked).map((s) => s.step),
      });
    } else {
      thesisProgress.unlocked_stages = progress.filter((s) => s.unlocked).map((s) => s.step);
      await thesisProgress.save();
    }

    res.status(200).json({
      eligible: isEligible,
      reason: isEligible ? "" : reason,
      progress: progress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { 
  checkProgressEligibility,
  getThesisProgress 
};