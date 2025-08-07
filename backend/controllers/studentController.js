const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const StudentCourse = require('../models/studentCourse');

const getStudentProfile = async (req, res) => {
  try {
    // req.user._id is the User _id from JWT
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'Student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = await Student.findOne({ user_id: user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student details not found' });
    }

    res.json({
      fullName: `${user.first_name} ${user.last_name}`,
      studentId: student.student_number,
      email: user.email,
      department: user.department,
      program: student.program_id,
      currentAcademicYear: student.admission_year
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getStudentProgress = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Get credits
    const courses = await StudentCourse.find({ student_id: student._id });
    const totalCredits = courses.reduce((sum, c) => sum + (c.obtained_credit || 0), 0);

    // Get supervisor assignment status
    const SupervisorAssignment = require('../models/supervisorAssignment');
    const assignment = await SupervisorAssignment.findOne({ student_id: student._id });

    // Unlock logic
    const creditsOk = totalCredits >= 9;
    const cgpaOk = student.cgpa > 2.5;
    const supervisorAssigned = assignment && assignment.status === 'Assigned';

    // Determine progress steps
    const progress = [
      { step: 'Enrolled', unlocked: true },
      { step: 'Supervisor Assignment', unlocked: creditsOk },
      { step: 'Thesis Proposal Submission', unlocked: creditsOk && cgpaOk && supervisorAssigned },
      { step: 'Thesis Submission', unlocked: creditsOk && cgpaOk && supervisorAssigned }, // add more conditions if needed
      { step: 'Predefense', unlocked: creditsOk && cgpaOk && supervisorAssigned },       // add more conditions if needed
      { step: 'Defense', unlocked: creditsOk && cgpaOk && supervisorAssigned }           // add more conditions if needed
    ];

    res.json({
      progress,
      totalCredits,
      cgpa: student.cgpa,
      supervisorAssignmentStatus: assignment?.status || 'Not started'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStudentCourses = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const courses = await StudentCourse.find({ student_id: student._id });
    const totalCredits = courses.reduce((sum, c) => sum + (c.obtained_credit || 0), 0);

    res.json({ courses, totalCredits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStudentProfile,
  getStudentProgress,
  getStudentCourses
};