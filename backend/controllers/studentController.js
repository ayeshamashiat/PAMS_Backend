const User = require('../models/user');
const Student = require('../models/student');
const StudentCourse = require('../models/studentCourse');
const SupervisorAssignment = require('../models/supervisorAssignment');
const Course = require('../models/course');
const ThesisProposal = require('../models/thesisProposal');

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
    // Step 1: Find student linked to logged-in user
    const student = await Student.findOne({ user_id: req.user._id })
      .populate('program_id')
      .exec();

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Step 2: Find all StudentCourse docs for this student
    const enrolledCourses = await StudentCourse.find({ student_id: student._id })
      .populate('course_id') // pull full course details
      .exec();

    if (!enrolledCourses.length) {
      return res.status(404).json({ message: 'No courses found for this student' });
    }

    // Step 3: Build final response
    const courseList = enrolledCourses.map(sc => ({
      _id: sc.course_id._id,
      course_code: sc.course_id.course_code,
      course_name: sc.course_id.course_name,
      credit: sc.course_id.credit,
      status: sc.course_id.status,

      // student-specific details
      semester: sc.semester,
      academic_year: sc.academic_year,
      grade: sc.grade || null,
      obtained_credit: sc.obtained_credit || 0
    }));

    // Step 4: Calculate total earned credits
    const totalEarnedCredits = enrolledCourses.reduce(
      (sum, c) => sum + (c.obtained_credit || 0),
      0
    );

    res.status(200).json({
      student: {
        _id: student._id,
        student_number: student.student_number,
        program_id: student.program_id,
        current_semester: student.current_semester,
        cgpa: student.cgpa
      },
      total_courses: enrolledCourses.length,
      totalEarnedCredits,
      enrolledCourses: courseList
    });
  } catch (error) {
    console.error('Error fetching student courses:', error.message);
    res.status(500).json({ error: error.message });
  }
};

const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user_id')
      .populate('department')
      .populate('program_id');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitThesisProposal = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Check eligibility (optional, for extra safety)
    if (student.cgpa <= 2.5 || student.total_credit_hours < 9) {
      return res.status(403).json({ error: 'Not eligible for thesis proposal submission.' });
    }

    const {
      supervisor_id,
      title,
      background,
      objective,
      methodology,
      estimated_cost,
      timeline,
      references
    } = req.body;

    if (!supervisor_id || !title || !background || !objective || !methodology) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    const attachment = req.file ? req.file.path : null;

    const proposal = new ThesisProposal({
      student_id: student._id,
      supervisor_id,
      title,
      background,
      objective,
      methodology,
      estimated_cost,
      timeline,
      references,
      attachment
    });

    await proposal.save();

    res.status(201).json({ message: 'Thesis proposal submitted', proposal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStudentProfile,
  getStudentProgress,
  getStudentCourses,
  getStudentById,
  submitThesisProposal
};

