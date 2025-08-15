const express = require('express');
const Student = require('../models/student');
const router = express.Router();
const {getStudentProfile, getStudentProgress, getStudentCourses} = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const supervisorAssignmentRoutes = require('./supervisorAssignmentRoutes'); // Add this line

//must be before :id
router.get('/profile', protect, getStudentProfile);
router.get('/progress', getStudentProgress);
router.get('/courses', protect, getStudentCourses);

// router.post('/', async (req, res) => {
//   try {
//     const student = new Student(req.body);
//     await student.save();
//     res.json({ message: 'Student created', student });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('userId')
      .populate('department')
      .exec();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//do a getStduentByID

router.use('/supervisor-assignment', supervisorAssignmentRoutes);

module.exports = router;
