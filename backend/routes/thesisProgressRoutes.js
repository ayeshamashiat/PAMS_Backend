// routes/thesisProgressRoutes.js
const express = require('express');
const router = express.Router();
const { checkProgressEligibility } = require('../controllers/thesisProgressController');

router.get('/check', checkProgressEligibility);

module.exports = router;
