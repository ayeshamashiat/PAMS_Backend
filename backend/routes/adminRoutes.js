// In routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { createUserByAdmin } = require('../controllers/userController');

router.post('/register-user', createUserByAdmin);

module.exports = router;
