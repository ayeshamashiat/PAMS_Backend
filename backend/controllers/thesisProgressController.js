// controllers/thesisProgressController.js
const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');
const { computeUnlockedStages } = require('../services/progressService');

const checkProgressEligibility = async (req, res) => {
  try {
    // ✅ find student by user_id from JWT
    const student = await Student.findOne({ user_id: req.user.id });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // ✅ Eligibility rule
    const isEligible = student.cgpa > 2.5 && student.obtained_credits >= 9;
    if (!isEligible) {
      return res.status(200).json({ isEligible: false, message: 'Not eligible for thesis progress yet.' });
    }

    // ✅ Compute unlocked stages for this student
    const unlockedStages = await computeUnlockedStages(student);

    let progress = await ThesisProgress.findOne({ student: student._id });
    if (!progress) {
      await ThesisProgress.create({
        student: student._id,
        current_stage: 'Enrolled',
        unlocked_stages: unlockedStages.filter(s => s.unlocked).map(s => s.step),
      });
    } else {
      progress.unlocked_stages = unlockedStages.filter(s => s.unlocked).map(s => s.step);
      await progress.save();
    }

    res.status(200).json({
      isEligible: true,
      message: 'Progress updated for this student.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { checkProgressEligibility };