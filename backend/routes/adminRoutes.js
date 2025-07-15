const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getAllStudents,
  getAllFaculty,
  getAllPGC,
  createStudent,
  createFaculty,
  createPGC,
  createAdmin
} = require('../controllers/userController');

router.get('/students', protect, adminOnly, getAllStudents);
router.get('/faculty', protect, adminOnly, getAllFaculty);
router.get('/pgc', protect, adminOnly, getAllPGC);

router.post('/create-student', protect, adminOnly, createStudent);
router.post('/create-faculty', protect, adminOnly, createFaculty);
router.post('/create-pgc', protect, adminOnly, createPGC);
router.post('/create-admin', protect, adminOnly, createAdmin);

router.get('/students', protect, adminOnly, getAllStudents);
router.get('/faculty', protect, adminOnly, getAllFaculty);
router.get('/pgc', protect, adminOnly, getAllPGC);


module.exports = router;
