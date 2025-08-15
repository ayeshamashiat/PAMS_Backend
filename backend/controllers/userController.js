// File: controllers/userController.js
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const Course = require('../models/course');
const crypto = require('crypto'); 
const fs = require('fs');
const csv = require('csv-parser');

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
Student Number: ${student_number}

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

      fs.unlinkSync(filePath);
      return res.status(201).json({
        message: 'Bulk student upload completed',
        total: results.length,
        failed: failed.length,
        errors: failed
      });
    });
};

const createFaculty = async (req, res) => {
  try {
    const {
      faculty_number,
      email,
      first_name,
      last_name,
      department,
      designation,
      specialization,
      research_interests
    } = req.body;

    if (!faculty_number || !email || !first_name || !last_name || !department || !designation) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { faculty_number }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = new User({
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
      employee_id: faculty_number,
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

Your Faculty Number: ${faculty_number}
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

const createBulkFacultyFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const filePath = req.file.path;
    const rows = await parseCSV(filePath);

    const results = [];

    for (const row of rows) {
      const {
        faculty_number,
        email,
        first_name,
        last_name,
        department,
        designation,
        specialization,
        research_interests
      } = row;

      const result = { email, success: false, message: '' };

      // Validate required fields
      if (!faculty_number || !email || !first_name || !last_name || !department || !designation) {
        result.message = 'Missing required fields';
        results.push(result);
        continue;
      }

      try {
        const existingUser = await User.findOne({ email }, {faculty_number});
        if (existingUser) {
          result.message = 'User already exists';
          results.push(result);
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
          role: 'Faculty'
        });

        const savedUser = await newUser.save();

        const newFaculty = new Faculty({
          user_id: savedUser._id,
          employee_id: faculty_number,
          department_id: null, // optional
          designation,
          specialization: specialization || '',
          research_interests: research_interests || '',
          max_supervision_capacity: 5,
          current_supervision_count: 0
        });

        await newFaculty.save();

        await sendEmail({
          email,
          subject: 'Your Faculty Account Credentials',
          message: `Dear ${first_name},

Your faculty account has been created.
Faculty Number: ${faculty_number}
Login credentials:
Email: ${email}
Password: ${rawPassword}

Please change your password after logging in.

Regards,
Admin Team`
        });

        result.success = true;
        result.message = 'Faculty created and email sent';
        results.push(result);

      } catch (err) {
        result.message = `Error: ${err.message}`;
        results.push(result);
      }
    }

    fs.unlinkSync(filePath); // Delete uploaded file after processing
    res.status(207).json({ results });

  } catch (error) {
    console.error('CSV upload error:', error);
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

const pushCoursesFromCSV = async (req, res) => {
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
          course_code,
          course_name,
          credit,
          semester,
          academic_year
        } = row;

        // Check required fields
        if (!course_code || !course_name || !credit || !semester || !academic_year) {
          failed.push({ course_code: course_code || 'N/A', reason: 'Missing required fields' });
          continue;
        }

        try {
          // Check if course already exists
          const existingCourse = await Course.findOne({ course_code });
          if (existingCourse) {
            failed.push({ course_code, reason: 'Course already exists' });
            continue;
          }

          // Save new course
          const newCourse = new Course({
            course_code,
            course_name,
            credit: Number(credit), // ensure it's a number
            semester,
            academic_year
          });

          await newCourse.save();
        } catch (err) {
          failed.push({ course_code, reason: err.message });
        }
      }

      return res.status(201).json({
        message: 'Bulk course upload completed',
        total: results.length,
        failed: failed.length,
        errors: failed
      });
    });
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
  setMaxSupervisionCap,
  createBulkFacultyFromCSV,
  pushCoursesFromCSV
};
