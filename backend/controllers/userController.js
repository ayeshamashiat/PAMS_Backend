// File: controllers/userController.js
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Student = require('../models/student');
const Faculty = require('../models/faculty');
const Course = require('../models/course');
const StudentCourse = require('../models/studentCourse'); 
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
      supervisor_id
    } = req.body;

    if (!student_number || !email || !first_name || !last_name || !program_id || !department) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // check if user or student already exists
    const existingUser = await User.findOne({ $or: [{ email }, { student_number }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // enforce admission year = current year only
    const currentYear = new Date().getFullYear();

    // password generation + hashing
    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // create user
    const newUser = new User({
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      department,
      role: 'Student'
    });
    const savedUser = await newUser.save();

    // create student with schema-aligned fields
    const student = new Student({
      user_id: savedUser._id,
      student_number,
      program_id,
      admission_year: currentYear, // enforce here
      current_semester: 1,
      cgpa: 0.0,
      total_credit_hours: 0,
      obtained_credits: 0,
      supervisor_id: supervisor_id || null,
      status: 'Applied'
    });

    await student.save();

    // email creds
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
    return res.status(400).json({ message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const results = [];
  const failed = [];

  try {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          const {
            student_number,
            email,
            first_name,
            last_name,
            program_id,
            department,
            supervisor_id
          } = row;

          // Validation: Check for required fields
          if (!student_number || !email || !first_name || !last_name || !program_id || !department) {
            failed.push({ student_number: student_number || "N/A", reason: "All fields are required" });
            continue;
          }

          try {
            // Validate department against schema enum
            const validDepartments = ['CSE', 'EEE', 'MPE', 'CEE', 'BTM'];
            if (!validDepartments.includes(department)) {
              failed.push({ student_number, reason: `Invalid department: ${department}` });
              continue;
            }

            // Validate program_id against schema enum
            const validPrograms = [
              'M.Sc. CSE', 'M.Sc. CE', 'M.Sc. ME', 'M.Sc. EEE', 'M.Sc. TVE',
              'M.Engg. CSE', 'M.Engg. ME', 'M.Engg. EEE', 'M.Engg. CE',
              'PhD CSE', 'PhD ME', 'PhD CE', 'PhD EEE', 'PhD TE'
            ];
            if (!validPrograms.includes(program_id)) {
              failed.push({ student_number, reason: `Invalid program_id: ${program_id}` });
              continue;
            }

            // Check if user or student already exists
            const existingUser = await User.findOne({ $or: [{ email }, { student_number }] });
            if (existingUser) {
              failed.push({ student_number, reason: "User already exists" });
              continue;
            }

            // Enforce admission year as current year
            const currentYear = new Date().getFullYear();

            // Generate and hash password
            const rawPassword = generatePassword();
            const hashedPassword = await bcrypt.hash(rawPassword, 10);

            // Create User
            const newUser = new User({
              email,
              password_hash: hashedPassword,
              first_name,
              last_name,
              department,
              role: "Student"
            });
            const savedUser = await newUser.save();

            // Create Student
            const student = new Student({
              user_id: savedUser._id,
              student_number,
              program_id,
              admission_year: currentYear,
              current_semester: 1,
              cgpa: 0.0,
              total_credit_hours: 0,
              obtained_credits: 0,
              supervisor_id: supervisor_id || null,
              status: "Applied",
              admission_date: currentYear,
            });

            await student.save();

            // Send email with credentials
            await sendEmail({
              email,
              subject: "Your Student Account Credentials",
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

          } catch (err) {
            console.error(`Error processing student ${student_number}:`, err);
            failed.push({ student_number, reason: err.message });
          }
        }

        // Delete the uploaded CSV file
        fs.unlinkSync(filePath);

        // Return response
        return res.status(201).json({
          message: "Bulk student upload completed",
          total: results.length,
          successful: results.length - failed.length,
          failed: failed.length,
          errors: failed
        });
      })
      .on("error", (err) => {
        console.error("CSV parsing error:", err);
        fs.unlinkSync(filePath);
        return res.status(500).json({ message: "Error processing CSV file" });
      });
  } catch (error) {
    console.error("Upload students error:", error);
    fs.unlinkSync(filePath);
    return res.status(500).json({ message: "Internal server error" });
  }
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

const createPGC = async (req, res) => {
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

    // Check if email or faculty_number already exists
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
      role: 'PGC'
    });

    const savedUser = await newUser.save();

    const newFaculty = new Faculty({
      user_id: savedUser._id,
      employee_id: faculty_number,
      department_id: null,
      designation,
      specialization: specialization || '',
      research_interests: research_interests || '',
      max_supervision_capacity: null, // Not applicable for PGC
      current_supervision_count: null // Not applicable for PGC
    });

    await newFaculty.save();

    // Send credentials via email
    await sendEmail({
      email,
      subject: 'Your PGC Account Credentials',
      message: `Dear ${first_name},

Your PGC committee account has been created.

Your Faculty Number: ${faculty_number}
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

const createBulkFacultyFromCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const results = [];
  const failed = [];

  try {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
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

          // Validation: Check for required fields
          if (!faculty_number || !email || !first_name || !last_name || !designation || !department) {
            failed.push({ faculty_number: faculty_number || "N/A", reason: "All fields are required" });
            continue;
          }

          try {
            const existingUser = await User.findOne({ $or: [{ email }, { faculty_number }] });
            if (existingUser) {
              failed.push({ faculty_number, reason: "User already exists" });
              continue;
            }
            // Generate and hash password
            const rawPassword = generatePassword();
            const hashedPassword = await bcrypt.hash(rawPassword, 10);

            // Create User
            const newUser = new User({
              email,
              password_hash: hashedPassword,
              first_name,
              last_name,
              department,
              role: "Faculty"
            });
            const savedUser = await newUser.save();

            // Create Student
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

            // Send email with credentials
            await sendEmail({
              email,
              subject: "Your Faculty Account Credentials",
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

          } catch (err) {
            console.error(`Error processing faculty ${faculty_number}:`, err);
            failed.push({ faculty_number, reason: err.message });
          }
        }

        // Delete the uploaded CSV file
        fs.unlinkSync(filePath);

        // Return response
        return res.status(201).json({
          message: "Bulk faculty upload completed",
          total: results.length,
          successful: results.length - failed.length,
          failed: failed.length,
          errors: failed
        });
      })
      .on("error", (err) => {
        console.error("CSV parsing error:", err);
        fs.unlinkSync(filePath);
        return res.status(500).json({ message: "Error processing CSV file" });
      });
  } catch (error) {
    console.error("Upload faculty error:", error);
    fs.unlinkSync(filePath);
    return res.status(500).json({ message: "Internal server error" });
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

const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    user.email = email || user.email;
    await user.save();

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const results = [];
  const failedUploads = [];
  const previewAssignments = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      for (const row of results) {
        const {
          course_code,
          course_name,
          department,
          credit,
          semester,
          academic_year,
        } = row;

        if (!course_code || !course_name || !department || !credit || !semester || !academic_year) {
          failedUploads.push({
            course_code: course_code || "N/A",
            reason: "Missing required fields",
          });
          continue;
        }

        try {
          const existing = await Course.findOne({ course_code });
          if (existing) {
            failedUploads.push({ course_code, reason: "Already exists" });
            continue;
          }

          const newCourse = new Course({
            course_code: course_code.trim(),
            course_name: course_name.trim(),
            department: department.trim(),
            credit: Number(credit),
            semester: semester.trim(),
            academic_year: academic_year.trim(),
          });
          await newCourse.save();

          // Generate preview for this course, excluding already assigned students (though unlikely for new courses)
          const extractedSemester = getSemesterFromCourseCode(newCourse.course_code);
          if (extractedSemester === null) {
            failedUploads.push({
              course_code: newCourse.course_code,
              reason: "Invalid course code format for semester extraction",
            });
            continue;
          }

          // Get IDs of students already assigned to this course (expected to be empty for new courses)
          const assignedStudentIds = await StudentCourse.find({ course_id: newCourse._id }).distinct('student_id');

          const students = await Student.find({
            current_semester: extractedSemester,
            _id: { $nin: assignedStudentIds }, // Exclude assigned students
          }).populate("user_id");

          const matchedStudents = students.filter(
            (s) => s.user_id && s.user_id.department === newCourse.department
          );

          const proposedStudents = matchedStudents.map((s) => ({
            student_id: s._id.toString(),
            student_number: s.student_number,
            name: `${s.user_id.first_name} ${s.user_id.last_name}`,
            email: s.user_id.email || "N/A",
          }));

          previewAssignments.push({
            course_id: newCourse._id.toString(),
            course_code: newCourse.course_code,
            extracted_semester: extractedSemester,
            department: newCourse.department,
            is_theory: isTheoryCourse(newCourse.course_code),
            proposed_students: proposedStudents,
          });

        } catch (err) {
          failedUploads.push({ course_code, reason: err.message });
        }
      }

      const total = results.length;
      const failedUploadCount = failedUploads.length;
      const successUploadCount = total - failedUploadCount;

      const courses = await Course.find();

      res.status(201).json({
        message: "Bulk course upload completed with assignment preview",
        total,
        successUploads: successUploadCount,
        failedUploads: failedUploadCount,
        uploadErrors: failedUploads,
        previewAssignments,
        courses,
      });
    });
};

const confirmAssignments = async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: "Invalid assignments data" });
    }

    let created = 0;
    let skipped = 0;
    const failed = [];

    for (const { course_id, assigned_students } of assignments) {
      const course = await Course.findById(course_id);
      if (!course) {
        failed.push({ course_id, reason: "Course not found" });
        continue;
      }

      const extractedSemester = getSemesterFromCourseCode(course.course_code);
      if (extractedSemester === null) {
        failed.push({ course_id, reason: "Invalid course code for semester" });
        continue;
      }

      for (const student_id of assigned_students) {
        const student = await Student.findById(student_id).populate("user_id");
        if (!student || !student.user_id) {
          failed.push({ course_id, student_id, reason: "Student or user not found" });
          continue;
        }

        // Validate department (from User) and semester match
        if (student.user_id.department !== course.department || student.current_semester !== extractedSemester) {
          failed.push({ 
            course_id, 
            student_id, 
            reason: `Mismatch: Student dept '${student.user_id.department}' ≠ Course dept '${course.department}' or semester '${student.current_semester}' ≠ '${extractedSemester}'` 
          });
          continue;
        }

        try {
          await StudentCourse.create({
            student_id: student._id,
            course_id: course._id,
            semester: extractedSemester.toString(),
            academic_year: student.admission_year.toString(),
            // Optional: Add is_theory if schema supports
            is_theory: isTheoryCourse(course.course_code),
          });
          created++;
        } catch (err) {
          if (err.code === 11000) {
            skipped++;
          } else {
            failed.push({ course_id, student_id, reason: err.message });
          }
        }
      }
    }

    return res.status(200).json({
      message: "Assignments confirmed",
      created,
      skipped,
      failedCount: failed.length,
      errors: failed,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function getSemesterFromCourseCode(code) {
  if (!code || typeof code !== 'string' || code.length < 7) {
    console.warn(`Invalid course code format: ${code}. Expected at least 7 characters.`);
    return null;
  }
  
  const semesterChar = code.charAt(4); // 0-based index 4 for 5th char
  const semester = parseInt(semesterChar);
  
  if (isNaN(semester) || semester < 1 || semester > 20) {
    console.warn(`Invalid semester in course code ${code}: '${semesterChar}' is not a valid semester number.`);
    return null;
  }
  
  return semester;
}

function isTheoryCourse(code) {
  if (!code || code.length < 7) return null;
  const typeChar = code.charAt(6); // 0-based index 6 for 7th char
  const typeNum = parseInt(typeChar);
  if (isNaN(typeNum)) return null;
  return typeNum % 2 === 1; // odd: true (theory), even: false (lab)
}

const generateAssignmentPreview = async (req, res) => {
  try {
    const { course_ids } = req.body;
    if (!Array.isArray(course_ids) || course_ids.length === 0) {
      return res.status(400).json({ message: "Invalid course IDs" });
    }

    const previewAssignments = [];
    for (const courseId of course_ids) {
      const course = await Course.findById(courseId);
      if (!course) continue;

      const extractedSemester = getSemesterFromCourseCode(course.course_code);
      if (extractedSemester === null) continue;

      // Get IDs of students already assigned to this course
      const assignedStudentIds = await StudentCourse.find({ course_id: courseId }).distinct('student_id');

      const students = await Student.find({
        current_semester: extractedSemester,
        _id: { $nin: assignedStudentIds }, // Exclude assigned students
      }).populate("user_id");

      const matchedStudents = students.filter(
        (s) => s.user_id && s.user_id.department === course.department
      );

      previewAssignments.push({
        course_id: course._id.toString(),
        course_code: course.course_code,
        extracted_semester: extractedSemester,
        department: course.department,
        is_theory: isTheoryCourse(course.course_code),
        proposed_students: matchedStudents.map((s) => ({
          student_id: s._id.toString(),
          student_number: s.student_number,
          name: `${s.user_id.first_name} ${s.user_id.last_name}`,
          email: s.user_id.email || "N/A",
        })),
      });
    }

    res.status(200).json({ previewAssignments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const searchStudents = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Search query is required" });

    const regex = new RegExp("^" + escapeRegex(query), "i");

    const students = await Student.find({
      user_id: { $ne: null },
      $or: [{ student_number: { $regex: regex } }]
    }).populate("user_id", "email department");

    const formattedStudents = students.map(s => ({
      _id: s._id,
      student_number: s.student_number,
      email: s.user_id?.email || "Unknown",
    }));

    res.status(200).json(formattedStudents);
  } catch (err) {
    console.error("❌ Student search error:", err);
    res.status(500).json({ message: err.message });
  }
};

const searchCourses = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Search query is required" });

    const regex = new RegExp("^" + escapeRegex(query), "i");

    const courses = await Course.find({
      $or: [
        { course_code: { $regex: regex } },
        { course_name: { $regex: regex } },
      ]
    });

    res.status(200).json(courses);
  } catch (err) {
    console.error("❌ Course search error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json({ courses });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const editCGPA = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { cgpa } = req.body;

    if (typeof cgpa !== 'number' || cgpa < 0 || cgpa > 4) {
      return res.status(400).json({ message: 'CGPA must be a number between 0 and 4' });
    }

    const student = await Student.findByIdAndUpdate(
      student_id,
      { cgpa },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ message: 'CGPA updated successfully', student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const editObtainedCredits = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { obtained_credits } = req.body;

    if (typeof obtained_credits !== 'number' || obtained_credits < 0) {
      return res.status(400).json({ message: 'Obtained credits must be a non-negative number' });
    }

    const student = await Student.findByIdAndUpdate(
      student_id,
      { obtained_credits },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ message: 'Obtained credits updated successfully', student });
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
  setMaxSupervisionCap,
  createBulkFacultyFromCSV,
  pushCoursesFromCSV,
  updateProfile,
  getAllCourses,
  searchStudents,
  searchCourses,
  editCGPA,
  editObtainedCredits,
  confirmAssignments,
  generateAssignmentPreview
};
