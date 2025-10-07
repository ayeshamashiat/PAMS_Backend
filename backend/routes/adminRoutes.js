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
  pushCoursesFromCSV,
  autoAssignCourses,
  assignCourseManually,
  updateProfile,
  getAllCourses,
  searchStudents,
  searchCourses,
  editCGPA,
  editObtainedCredits,
  confirmAssignments,
  generateAssignmentPreview
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const uploadStudentCSV = require("../middleware/uploadStudentCSV");
const uploadFacultyCSV = require("../middleware/uploadFacultyCSV");
const uploadCourseCSV = require("../middleware/uploadCourseCSV");


router.post('/create-student/manual-student-creation', createStudent);
router.post('/create-faculty', createFaculty);
router.post('/create-pgc', createPGC);
router.post("/create-student/bulk-upload", uploadStudentCSV.single("file"), uploadStudentsFromCSV);
router.post('/create-faculty/bulk-upload', uploadFacultyCSV.single("file"), createBulkFacultyFromCSV);
router.post('/upload-courses', uploadCourseCSV.single("file"), pushCoursesFromCSV);
router.post('/confirm-assignment', confirmAssignments);
router.post('/generate-preview', protect, generateAssignmentPreview); 

router.get('/profile', protect, getAdminProfile);
router.get('/students', getAllStudents);
router.get('/faculty', getAllFaculty);
router.get('/pgc', getAllPGC);
router.get('/courses', getAllCourses);
router.get("/search/students", searchStudents);
router.get("/search/courses", searchCourses);
router.patch('/faculty/:facultyId/max-supervision-cap', protect, setMaxSupervisionCap);
router.patch('/profile', protect, updateProfile);
router.put('/student/:student_id/edit-cgpa', protect, editCGPA);
router.put('/student/:student_id/edit-credits', protect, editObtainedCredits);

module.exports = router;
