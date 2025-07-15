// File: controllers/userController.js
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const PGC = require('../models/pgc');
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
      program,
      department,
      role: 'Student'
    });

    const savedUser = await newUser.save();

    const student = new Student({
      user_id: savedUser._id,
      first_name,
      last_name,
      department,
      program,
      admission_year: academic_year,
      current_semester: 1
    });
    await student.save();

    await sendEmail({
      email,
      subject: 'Your Student Account Credentials',
      message: `Dear ${first_name},\n\nYour student account has been created.\n\nLogin credentials:\nEmail: ${email}\nPassword: ${rawPassword}\n\nPlease change your password after logging in.\n\nRegards,\nAdmin Team`
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

    const faculty = new Faculty({
      user_id: savedUser._id,
      employee_id: user_id,
      designation
    });
    await faculty.save();

    await sendEmail({
      email,
      subject: 'Your Faculty Account Credentials',
      message: `Dear ${first_name},\n\nYour faculty account has been created.\n\nLogin credentials:\nEmail: ${email}\nPassword: ${rawPassword}\n\nPlease change your password after logging in.\n\nRegards,\nAdmin Team`
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
  getAllStudents,
  getAllFaculty,
  getAllPGC,
  register
};
