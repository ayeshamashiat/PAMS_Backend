const express = require('express');
const router = express.Router();

router.post('/create-student', createStudent);
router.post('/create-faculty', createFaculty);
router.post('/create-pgc', createPGC);

router.get('/students', getAllStudents);
router.get('/faculty', getAllFaculty);
router.get('/pgc', getAllPGC);

module.exports = router;
