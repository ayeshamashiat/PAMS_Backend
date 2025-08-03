const express = require('express');
const router = express.Router();
const controller = require('../controllers/supervisorAssignmentController');

router.post('/available', controller.getAvailableSupervisors);
router.post('/create', controller.createAssignmentRequest);
router.post('/supervisor-respond', controller.supervisorRespond);
router.post('/pgc-respond', controller.pgcRespond);

module.exports = router;