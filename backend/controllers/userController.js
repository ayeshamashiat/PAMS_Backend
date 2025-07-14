// File: controllers/userController.js

const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
// const PGC = require('../models/pgc'); // PGC model placeholder

// Admin creates a user manually
const createUserByAdmin = async (req, res) => {
  try {
    const {
      user_id,
      email,
      password,
      first_name,
      last_name,
      program,
      department,
      role
    } = req.body;

    // Validate required fields
    if (!user_id || !email || !password || !first_name || !last_name || !program || !department || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if email or user_id is already in use
    const existingUser = await User.findOne({ $or: [{ email }, { user_id }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      user_id,
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      program,
      department,
      role
    });

    const savedUser = await newUser.save();

    // Automatically create stakeholder-specific model
    if (role === 'Student') {
      const student = new Student({
        user_id: savedUser._id,
        student_number: user_id, // Assuming user_id doubles as student_number
        admission_year: new Date().getFullYear()
      });
      await student.save();
    } else if (role === 'Faculty') {
      const FacultyModel = require('../models/faculty');
      const faculty = new FacultyModel({
        user_id: savedUser._id,
        employee_id: user_id // Assuming user_id doubles as employee_id
      });
      await faculty.save();
    } else if (role === 'PGC') {
      // Placeholder for future implementation
      // const pgc = new PGC({ user_id: savedUser._id });
      // await pgc.save();
    }

    res.status(201).json({ message: `${role} user created successfully` });
  } catch (error) {
    console.error('Admin user creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const register = (req, res) => {
  res.status(403).json({ message: 'Self-registration is disabled. Please contact an administrator.' });
};

module.exports = {
  createUserByAdmin,
  register // Exported in case route exists but returns 403
};