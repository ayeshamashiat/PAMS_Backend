const express = require('express');
const router = express.Router();
const { getNotifications } = require('../utils/notification');

// GET /api/notifications/:userId
router.get('/:userId', (req, res) => {
  const userId = req.params.userId;
  res.json(getNotifications(userId));
});

module.exports = router;