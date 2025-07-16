const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createStudent,
  createFaculty,
  createPGC
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/create-student', protect, adminOnly, createStudent);
router.post('/create-faculty', protect, adminOnly, createFaculty);
router.post('/create-pgc', protect, adminOnly, createPGC);

module.exports = router;
