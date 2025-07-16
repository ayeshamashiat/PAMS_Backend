// File: controllers/userController.js
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const crypto = require('crypto'); 

const generatePassword = () => {
  return crypto.randomBytes(6).toString('base64');
};

const createStudent = async (req, res) => {
  try {
    const {
      user_id,
      email,
      first_name,
      last_name,
      program, 
      department,
      academic_year
    } = req.body;

    if (!user_id || !email || !first_name || !last_name || !program || !department || !academic_year) {
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
      role: 'Student'
    });

    const savedUser = await newUser.save();

    const student = new Student({
      user_id: savedUser._id,
      student_number: user_id,
      program_id: program,
      admission_year: academic_year,
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

module.exports = {
  createStudent,
  createFaculty,
  createPGC,
  getAllStudents,
  getAllFaculty,
  getAllPGC
};
