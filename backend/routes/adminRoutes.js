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

router.post('/create-student', protect, adminOnly, createStudent);
router.post('/create-faculty', protect, adminOnly, createFaculty);
router.post('/create-pgc', protect, adminOnly, createPGC);

router.get('/students', protect, requireRole('Admin', 'PGC'), getAllStudents);
router.get('/faculty', protect, requireRole('Admin', 'PGC'), getAllFaculty);
router.get('/pgc', protect, adminOnly, getAllPGC);

module.exports = router;
