// File: controllers/userController.js
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
// const PGC = require('../models/pgc'); // PGC model placeholder

// Admin creates a student user manually
const crypto = require('crypto'); // Use to generate secure random password

// Helper to generate a random password
const generatePassword = () => {
  return crypto.randomBytes(6).toString('base64'); // 8-char random string
};

// Admin creates a student user manually (with generated password)
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

    const rawPassword = generatePassword(); // generate random password
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = new User({
      user_id,
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      program,
      department,
      role: 'Student'
    });

    const savedUser = await newUser.save();

    const student = new Student({
      user_id: savedUser._id,
      student_number: user_id,
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
      role: 'Faculty'
    });

    const savedUser = await newUser.save();

    const FacultyModel = require('../models/faculty');
    const faculty = new FacultyModel({
      user_id: savedUser._id,
      employee_id: user_id,
      designation
    });
    await faculty.save();

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
      department,
      designation
    } = req.body;

    if (!user_id || !email || !first_name || !last_name || !department || !designation) {
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
      program: '',
      department,
      role: 'PGC'
    });

    const savedUser = await newUser.save();

    const pgc = new PGC({
      user_id: savedUser._id,
      pgc_id: user_id,
      designation
    });
    await pgc.save();

    await sendEmail({
      email,
      subject: 'Your PGC Committee Account Credentials',
      message: `Dear ${first_name},\n\nYour PGC committee account has been created.\n\nLogin credentials:\nEmail: ${email}\nPassword: ${rawPassword}\n\nPlease change your password after logging in.\n\nRegards,\nAdmin Team`
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

const createAdmin = async (req, res) => {
  try {
    const {
      user_id,
      email,
      first_name,
      last_name,
      department,
      designation // optional, can be added if you want
    } = req.body;

    // Validate required fields
    if (!user_id || !email || !first_name || !last_name || !department) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Generate password and hash
    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Create User
    const newUser = new User({
      user_id,
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      program: '',
      department,
      role: 'Admin'
    });

    const savedUser = await newUser.save();

    // Optionally, if you want to save admin-specific info, create a separate Admin model here

    // Send email with credentials
    await sendEmail({
      email,
      subject: 'Your Admin Account Credentials',
      message: `Dear ${first_name},

Your admin account has been created.

Login credentials:
Email: ${email}
Password: ${rawPassword}

Please change your password after logging in.

Regards,
Admin Team`
    });

    // Respond with credentials
    res.status(201).json({
      message: 'Admin created successfully',
      credentials: {
        email,
        password: rawPassword
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find().populate('user_id');
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students' });
  }
};

const getAllFaculty = async (req, res) => {
  try {
    const faculties = await Faculty.find().populate('user_id');
    res.status(200).json(faculties);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch faculty' });
  }
};

const getAllPGC = async (req, res) => {
  try {
    const pgcs = await PGC.find().populate('user_id');
    res.status(200).json(pgcs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch PGC members' });
  }
};

const register = (req, res) => {
  res.status(403).json({ message: 'Self-registration is disabled. Please contact an administrator.' });
};

module.exports = {
  createStudent,
  createFaculty,
  createPGC,
  createAdmin,
  getAllStudents,
  getAllFaculty,
  getAllPGC,
  register // if you're using it
};

