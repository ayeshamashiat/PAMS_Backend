// backend/routes/userRoutes.js
const express = require('express');
const { protect, authorizeSelf } = require('../middleware/authMiddleware');

const router = express.Router();

// Sample protected route
router.get('/dashboard', protect, (req, res) => {
  res.json({ message: `Hello, user ${req.user.id}. You are authenticated.` });
});

// Only allow user to access their own profile
router.get('/profile/:id', protect, authorizeSelf, (req, res) => {
  res.json({ message: `This is your profile.` });
});

module.exports = router; 
