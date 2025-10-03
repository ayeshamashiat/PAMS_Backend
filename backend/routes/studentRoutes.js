// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getStudentProfile,
  submitThesisProposal,
  getStudentProgress,
  getStudentCourses,
  getStudentById,
  getResult,
  checkSupervisorEligibility,
  checkAssignmentStatus,
  getMyProposal,
  downloadProposalPDF,
} = require('../controllers/studentController');
const supervisorAssignmentRoutes = require('./supervisorAssignmentRoutes');
const thesisProposalEligibility = require('./thesisProgressRoutes'); 
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/profile', protect, getStudentProfile);
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
router.get('/result', protect, getResult);
router.use('/supervisor-assignment', supervisorAssignmentRoutes);
router.post('/submit/check', protect, upload.single('attachment'), submitThesisProposal);
router.get('/supervisor-assignment/check-eligibility', protect, checkSupervisorEligibility);
router.get('/assignment/check-status', protect, checkAssignmentStatus);
router.get('/my-proposal', protect, getMyProposal);
router.get('/proposal-pdf/:proposalId', protect, downloadProposalPDF);
router.get('/progress', protect, getStudentProgress);
router.get('/:id', getStudentById);


module.exports = router;
