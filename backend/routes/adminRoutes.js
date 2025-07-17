const express = require('express');
const router = express.Router();
const {
  createStudent,
  createFaculty,
  createPGC,
  getAllStudents,
  getAllFaculty,
  getAllPGC
} = require('../controllers/userController');
const { protect, adminOnly, requireRole } = require('../middleware/authMiddleware');

router.post('/create-student', createStudent);
router.post('/create-faculty', createFaculty);
router.post('/create-pgc', createPGC);

router.get('/students', getAllStudents);
router.get('/faculty', getAllFaculty);
router.get('/pgc', getAllPGC);

module.exports = router;
