const express = require('express');
const { protect, authorizeSelf } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', protect, (req, res) => {
  res.json({ message: `Hello, user ${req.user.id}. You are authenticated.` });
});

router.get('/profile/:id', protect, authorizeSelf, (req, res) => {
  res.json({ message: `This is your profile.` });
});

module.exports = router; 
