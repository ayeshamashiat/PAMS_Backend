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
  getAdminProfile,
  setMaxSupervisionCap,
  createBulkFacultyFromCSV,
  pushCoursesFromCSV
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');


router.post('/create-student/manual-student-creation', createStudent);
router.post('/create-faculty', createFaculty);
router.post('/create-pgc', createPGC);
router.post('/create-student/bulk-upload', upload.single('file'), uploadStudentsFromCSV);
router.post('/create-faculty/bulk-upload', upload.single('file'), createBulkFacultyFromCSV);
router.post('/upload-courses', upload.single('file'), pushCoursesFromCSV);

router.get('/profile', protect, getAdminProfile);
router.get('/students', getAllStudents);
router.get('/faculty', getAllFaculty);
router.get('/pgc', getAllPGC);
router.patch('/faculty/:facultyId/max-supervision-cap', protect, setMaxSupervisionCap);

module.exports = router;
