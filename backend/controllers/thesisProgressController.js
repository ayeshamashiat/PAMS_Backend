// controllers/thesisProgressController.js
const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');
const { computeUnlockedStages } = require('../services/progressService');

const checkProgressEligibility = async (req, res) => {
  try {
    const students = await Student.find();

    for (const student of students) {
      const unlockedStages = await computeUnlockedStages(student);

      let progress = await ThesisProgress.findOne({ student: student._id });
      if (!progress) {
        await ThesisProgress.create({
          student: student._id,
          current_stage: 'Enrolled',
          unlocked_stages: unlockedStages.filter(s => s.unlocked).map(s => s.step)
        });
      } else {
        progress.unlocked_stages = unlockedStages.filter(s => s.unlocked).map(s => s.step);
        await progress.save();
      }
    }

    res.status(200).json({ message: 'Progress updated for eligible students.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { checkProgressEligibility };
