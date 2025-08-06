const express = require('express');
const router = express.Router();
const { createAssignmentRequest, getAvailableSupervisors} = require('../controllers/supervisorAssignmentController');

router.get('/available', getAvailableSupervisors);
router.post('/create', createAssignmentRequest);

module.exports = router;