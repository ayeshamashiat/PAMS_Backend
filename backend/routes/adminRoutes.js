const express = require('express');
const router = express.Router();
const {
  createStudent,
  createFaculty
} = require('../controllers/userController');

router.post('/create-student', createStudent);
router.post('/create-faculty', createFaculty);

module.exports = router;
