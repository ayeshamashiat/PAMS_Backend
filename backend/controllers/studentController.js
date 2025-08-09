const User = require('../models/user');
const Student = require('../models/student');
const StudentCourse = require('../models/studentCourse');
const SupervisorAssignment = require('../models/supervisorAssignment');
const Course = require('../models/course');


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
    const student = await Student.findOne({ user_id: req.user._id })
      .populate('program_id') // only if program info is stored like this
      .exec();

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const programId = student.program_id || student.department; // use the correct field here
    if (!programId) return res.status(400).json({ error: 'Program/Department not assigned to student' });

    // Step 1: Get all courses for this student's program
    const assignedCourses = await Course.find({ program_id: programId, status: 'Active' });

    // Step 2: Get courses student has already taken
    const takenCourses = await StudentCourse.find({ student_id: student._id });
    console.log('Student:', student);
    console.log('Program ID:', programId);
    console.log('Assigned courses:', assignedCourses.length);
    console.log('Taken courses:', takenCourses.length);

    // Step 3: Map taken courses to quickly lookup grades
    const takenMap = new Map();
    takenCourses.forEach((course) => {
      takenMap.set(course.course_id.toString(), {
        obtained_credit: course.obtained_credit,
        grade: course.grade
      });
    });

    // Step 4: Prepare final result with optional grade info
    const courseList = assignedCourses.map((course) => {
      const taken = takenMap.get(course._id.toString());
      return {
        _id: course._id,
        course_code: course.course_code,
        course_name: course.course_name,
        credit: course.credit,
        semester: course.semester,
        academic_year: course.academic_year,
        status: course.status,
        taken: !!taken,
        grade: taken?.grade || null,
        obtained_credit: taken?.obtained_credit || null
      };
    });

    // Optional total credits if needed
    const totalEarnedCredits = takenCourses.reduce((sum, c) => sum + (c.obtained_credit || 0), 0);

    res.json({ assignedCourses: courseList, totalEarnedCredits });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  getStudentProfile,
  getStudentProgress,
  getStudentCourses
};