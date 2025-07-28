const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  createStudent,
  uploadStudentsFromCSV,
  createFaculty,
  createPGC,
  getAllStudents,
  getAllFaculty,
  getAllPGC,
  getAdminProfile
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');


router.post('/create-student/manual-student-creation', createStudent);
router.post('/create-faculty', createFaculty);
router.post('/create-pgc', createPGC);
router.post('/create-student/bulk-upload', upload.single('file'), uploadStudentsFromCSV);

router.get('/profile', protect, adminOnly, getAdminProfile);
router.get('/students', getAllStudents);
router.get('/faculty', getAllFaculty);
router.get('/pgc', getAllPGC);

module.exports = router;
