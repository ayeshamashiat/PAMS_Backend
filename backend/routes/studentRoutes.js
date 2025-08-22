const express = require('express');
const Student = require('../models/student');
const router = express.Router();
const {getStudentProfile, submitThesisProposal, getStudentProgress, getStudentCourses, getStudentById} = require('../controllers/studentController');
const supervisorAssignmentRoutes = require('./supervisorAssignmentRoutes'); 
const {protect} = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

//must be before :id
router.get('/profile', getStudentProfile);
router.get('/progress', getStudentProgress);
router.get('/courses', protect, getStudentCourses);

router.post('/', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.json({ message: 'Student created', student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', getStudentById);

router.use('/supervisor-assignment', supervisorAssignmentRoutes);

router.post('/submit', upload.single('attachment'), submitThesisProposal);

module.exports = router;
