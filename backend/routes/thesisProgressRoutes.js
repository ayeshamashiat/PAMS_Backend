const express = require('express');
const router = express.Router();
const { checkProgressEligibility } = require('../controllers/progressController');

router.get('/check', checkProgressEligibility);

module.exports = router;
