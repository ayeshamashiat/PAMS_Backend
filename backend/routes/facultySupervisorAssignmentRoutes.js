const express = require('express');
const router = express.Router();
const { supervisorRespond } = require('../controllers/supervisorAssignmentController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/supervisor-respond', supervisorRespond);

module.exports = router;