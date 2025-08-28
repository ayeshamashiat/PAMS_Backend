const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');
const { computeUnlockedStages } = require('../services/progressService');

const stageLabels = {
  Proposal: "Thesis Proposal",
  Thesis: "Thesis Upload",
  Predefense: "Predefense",
  Defense: "Defense",
  "Supervisor Assignment": "Supervisor Assignment",
  Enrolled: "Enrolled",
};

const checkProgressEligibility = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user.id });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Eligibility
    const hasSupervisor = !!student.supervisor_id;
    const isEligible =
      student.cgpa > 2.5 &&
      student.obtained_credits >= 9 &&
      hasSupervisor;

    // Compute unlocked stages
    const unlockedStages = await computeUnlockedStages(student);

    // Rename stages for frontend consistency
    const progress = unlockedStages.map((s) => ({
      step: stageLabels[s.step] || s.step,
      unlocked: s.unlocked,
    }));

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
      reason: isEligible
        ? ""
        : !hasSupervisor
        ? "No supervisor assigned yet."
        : "CGPA ≤ 2.5 or Obtained Credits < 9",
      progress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


module.exports = { checkProgressEligibility };
