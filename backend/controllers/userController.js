// File: controllers/userController.js
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const crypto = require('crypto'); 
const fs = require('fs');
const csv = require('csv-parser');
const StudentCourse = require('../models/studentCourse');

const generatePassword = () => {
  return crypto.randomBytes(6).toString('base64');
};

const createStudent = async (req, res) => {
  try {
    const {
      student_number,
      email,
      first_name,
      last_name,
      program_id, 
      department,
      admission_year
    } = req.body;

    if (!student_number  || !email || !first_name || !last_name || !program_id || !department || !admission_year) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });
    // if (existingUser) {
    //   return res.status(409).json({ message: 'User already exists' });
    // }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = new User({

      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      department,
      role: 'Student'
    });

    const savedUser = await newUser.save();

    const student = new Student({
      user_id: savedUser._id,
      student_number: student_number,
      program_id: program_id,
      admission_year: admission_year,
      current_semester: 1
    });

    await student.save();

    await sendEmail({
      email,
      subject: 'Your Student Account Credentials',
      message: `Dear ${first_name},

Your student account has been created.

Login credentials:
Email: ${email}
Password: ${rawPassword}

Please change your password after logging in.

Regards,
Admin Team`
    });

    res.status(201).json({
      message: 'Student created successfully',
      credentials: {
        email,
        password: rawPassword
      }
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const uploadStudentsFromCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const results = [];
  const failed = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (const row of results) {
        const {
          student_number,
          email,
          first_name,
          last_name,
          program_id,
          department,
          admission_year
        } = row;

        if (!student_number || !email || !first_name || !last_name || !program_id || !department || !admission_year) {
          failed.push({ student_number, reason: 'Missing required fields' });
          continue;
        }

        try {
          const existingUser = await User.findOne({ $or: [{ email }] });
          if (existingUser) {
            failed.push({ student_number, reason: 'User already exists' });
            continue;
          }

          const rawPassword = generatePassword();
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          const newUser = new User({
            email,
            password_hash: hashedPassword,
            first_name,
            last_name,
            department,
            role: 'Student'
          });

          const savedUser = await newUser.save();

          const student = new Student({
            user_id: savedUser._id,
            student_number,
            program_id,
            admission_year,
            current_semester: 1
          });

          await student.save();

          await sendEmail({
            email,
            subject: 'Your Student Account Credentials',
            message: `Dear ${first_name},

Your student account has been created.

Login credentials:
Email: ${email}
Password: ${rawPassword}

Please change your password after logging in.

Regards,
Admin Team`
          });

        } catch (err) {
          failed.push({ student_number, reason: err.message });
        }
      }

      return res.status(201).json({
        message: 'Bulk student upload completed',
        total: results.length,
        failed: failed.length,
        errors: failed
      });
    });
};




// Admin creates a faculty user manually (with generated password)
const createFaculty = async (req, res) => {
  try {
    const {
      user_id,
      email,
      first_name,
      last_name,
      department,
      designation,
      specialization,
      research_interests
    } = req.body;

    if (!user_id || !email || !first_name || !last_name || !department || !designation) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = new User({
      user_id,
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      department,
      role: 'Faculty'
    });

    const savedUser = await newUser.save();

    const newFaculty = new Faculty({
      user_id: savedUser._id,
      employee_id: user_id,
      department_id: null, 
      designation,
      specialization: specialization || '',
      research_interests: research_interests || '',
      max_supervision_capacity: 5,
      current_supervision_count: 0
    });

    await newFaculty.save();

    // Send credentials via email
    await sendEmail({
      email,
      subject: 'Your Faculty Account Credentials',
      message: `Dear ${first_name},

Your faculty account has been created.

Login credentials:
Email: ${email}
Password: ${rawPassword}

Please change your password after logging in.

Regards,
Admin Team`
    });

    res.status(201).json({
      message: 'Faculty created successfully',
      credentials: {
        email,
        password: rawPassword
      }
    });

  } catch (error) {
    console.error('Create faculty error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const createPGC = async (req, res) => {
  try {
    const {
      user_id,
      email,
      first_name,
      last_name,
      designation,
      department
    } = req.body;

    if (!user_id || !email || !first_name || !last_name || !designation || !department) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = new User({
      user_id,
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      department,
      program: '',
      role: 'PGC'
    });

    const savedUser = await newUser.save();

    const FacultyModel = require('../models/faculty');
    const pgcAsFaculty = new FacultyModel({
      user_id: savedUser._id,
      employee_id: user_id,
      designation,
      department_id: null 
    });
    await pgcAsFaculty.save();

    await sendEmail({
      email,
      subject: 'Your PGC Account Credentials',
      message: `Dear ${first_name},

Your PGC committee account has been created.

Login credentials:
Email: ${email}
Password: ${rawPassword}

Please change your password after logging in.

Regards,
Admin Team`
    });

    res.status(201).json({
      message: 'PGC member created successfully',
      credentials: {
        email,
        password: rawPassword
      }
    });
  } catch (error) {
    console.error('Create PGC error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const user = req.user;

    return res.status(200).json({
      message: 'Admin profile fetched successfully',
      email: user.email,
      full_name: `${user.first_name} ${user.last_name}`,
      department: user.department,
      role: user.role
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};



const getAllStudents = async (req, res) => {
  try {
    const studentsWithDetails = await User.aggregate([
      { $match: { role: 'Student' } },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: 'user_id',
          as: 'student_details'
        }
      },
      {
        $unwind: {
          path: '$student_details',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'faculties',
          localField: 'student_details.supervisor_id',
          foreignField: '_id',
          as: 'supervisor_info'
        }
      },
      {
        $unwind: {
          path: '$supervisor_info',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'supervisor_info.user_id',
          foreignField: '_id',
          as: 'supervisor_user'
        }
      },
      {
        $unwind: {
          path: '$supervisor_user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          password_hash: 0, // Exclude password hash
          'student_details.user_id': 0, // Exclude redundant user_id
          'supervisor_user.password_hash': 0, // Exclude supervisor password
          'supervisor_user.role': 0
        }
      },
      {
        $addFields: {
          'student_details.supervisor_name': {
            $concat: ['$supervisor_user.first_name', ' ', '$supervisor_user.last_name']
          }
        }
      },
      {
        $sort: { first_name: 1, last_name: 1 }
      }
    ]);

    res.status(200).json({
      message: 'Students retrieved successfully',
      count: studentsWithDetails.length,
      students: studentsWithDetails
    });

  } catch (error) {
    console.error('Get all students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getAllFaculty = async (req, res) => {
  try {
    const facultyMembers = await User.aggregate([
      { $match: { role: 'Faculty' } },
      {
        $lookup: {
          from: 'faculties',
          localField: '_id',
          foreignField: 'user_id',
          as: 'faculty_details'
        }
      },
      {
        $unwind: {
          path: '$faculty_details',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: 'faculty_details._id',
          foreignField: 'supervisor_id',
          as: 'supervised_students'
        }
      },
      {
        $addFields: {
          'faculty_details.actual_supervision_count': { $size: '$supervised_students' }
        }
      },
      {
        $project: {
          password_hash: 0, // Exclude password hash
          'faculty_details.user_id': 0, // Exclude redundant user_id
          supervised_students: 0 // Remove the temporary array
        }
      },
      {
        $sort: { first_name: 1, last_name: 1 }
      }
    ]);

    res.status(200).json({
      message: 'Faculty members retrieved successfully',
      count: facultyMembers.length,
      faculty: facultyMembers
    });

  } catch (error) {
    console.error('Get all faculty error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getAllPGC = async (req, res) => {
  try {
    const pgcMembers = await User.aggregate([
      { $match: { role: 'PGC' } },
      {
        $lookup: {
          from: 'faculties',
          localField: '_id',
          foreignField: 'user_id',
          as: 'faculty_details'
        }
      },
      {
        $unwind: {
          path: '$faculty_details',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: 'faculty_details._id',
          foreignField: 'supervisor_id',
          as: 'supervised_students'
        }
      },
      {
        $addFields: {
          'faculty_details.actual_supervision_count': { $size: '$supervised_students' }
        }
      },
      {
        $project: {
          password_hash: 0, // Exclude password hash
          'faculty_details.user_id': 0, // Exclude redundant user_id
          supervised_students: 0 // Remove the temporary array
        }
      },
      {
        $sort: { first_name: 1, last_name: 1 }
      }
    ]);

    res.status(200).json({
      message: 'PGC members retrieved successfully',
      count: pgcMembers.length,
      pgc_members: pgcMembers
    });

  } catch (error) {
    console.error('Get all PGC members error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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

const setMaxSupervisionCap = async (req, res) => {
  try {
    const { facultyId } = req.params;
    const { max_supervision_capacity } = req.body;

    if (typeof max_supervision_capacity !== 'number' || max_supervision_capacity < 0) {
      return res.status(400).json({ message: 'max_supervision_capacity must be a non-negative number' });
    }

    const faculty = await Faculty.findByIdAndUpdate(
      facultyId,
      { max_supervision_capacity },
      { new: true }
    );

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    res.json({
      message: 'Max supervision capacity updated successfully',
      faculty
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
  createStudent,
  uploadStudentsFromCSV,
  createFaculty,
  createPGC,
  getAdminProfile,
  getAllStudents,
  getAllFaculty,
  getAllPGC,
  getStudentProfile,
  getStudentProgress,
  setMaxSupervisionCap,
  getStudentCourses
};
