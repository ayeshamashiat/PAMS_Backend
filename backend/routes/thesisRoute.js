// routes/thesisRoutes.js

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Student-only route
router.post(
  '/register-thesis',
  requireAuth(),
  requireRole('Student'),
  (req, res) => {
    res.json({ message: 'Thesis registered' });
  }
);

// Faculty and PGC route
router.get(
  '/review-thesis',
  requireAuth(),
  requireRole('Faculty', 'PGC'),
  (req, res) => {
    res.json({ message: 'Thesis review accessed' });
  }
);

// PGC-only route
router.post(
  '/approve-thesis',
  requireAuth(),
  requireRole('PGC'),
  (req, res) => {
    res.json({ message: 'Thesis approved' });
  }
);

module.exports = router;
