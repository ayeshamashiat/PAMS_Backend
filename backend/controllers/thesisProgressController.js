const StudentCourseList = require('../models/StudentCourseList');
const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');

const checkProgressEligibility = async (req, res) => {
  try {
    const students = await Student.find();

    for (const student of students) {
      const courseRecord = await StudentCourseList.findOne({ student_id: student._id });
      const progress = await ThesisProgress.findOne({ student: student._id });

      const credits = courseRecord?.completed_credits || 0;
      const cgpa = courseRecord?.cgpa || 0;

      let unlocked = progress?.unlocked_stages || [];

      // Unlock Supervisor Assignment
      if (credits >= 9 && cgpa > 2.5 && !unlocked.includes('Supervisor Assignment')) {
        unlocked.push('Supervisor Assignment');
      }

      if (credits >= 9 && cgpa > 2.5 && !unlocked.includes('Proposal')) {
        unlocked.push('Proposal');
      }
      if (credits >= 9 && cgpa > 2.5 && !unlocked.includes('Thesis')) {
        unlocked.push('Thesis');
      }

      if (!progress) {
        await ThesisProgress.create({
          student: student._id,
          current_stage: 'Enrolled',
          unlocked_stages: unlocked
        });
      } else {
        progress.unlocked_stages = unlocked;
        await progress.save();
      }
    }

    res.status(200).json({ message: "Progress updated for eligible students." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  checkProgressEligibility
}
