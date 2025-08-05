const express = require('express');
const router = express.Router();
const controller = require('../controllers/supervisorAssignmentController');

router.get('/available', controller.getAvailableSupervisors);
router.post('/create', controller.createAssignmentRequest);

module.exports = router;