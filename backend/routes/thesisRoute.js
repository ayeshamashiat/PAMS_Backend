// routes/thesisRoutes.js

const express = require('express');
const { protect, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const thesisController = require('../controllers/thesisController');

const router = express.Router();

// Student-only route
router.post(
  '/register-thesis',
  protect,
  requireRole('Student'),
  (req, res) => {
    res.json({ message: 'Thesis registered' });
  }
);

// Faculty and PGC route
router.get(
  '/review-thesis',
  protect,
  requireRole('Faculty', 'PGC'),
  (req, res) => {
    res.json({ message: 'Thesis review accessed' });
  }
);

// PGC-only route
router.post(
  '/approve-thesis',
  protect,
  requireRole('PGC'),
  (req, res) => {
    res.json({ message: 'Thesis approved' });
  }
);

// Student upload their final thesis (PDF) after proposal approved
router.post(
  '/upload',
  protect,
  requireRole('Student'),
  upload.single('attachment'),
  thesisController.uploadThesis
);

// Student fetch their thesis
router.get('/my-thesis', protect, requireRole('Student'), thesisController.getMyThesis);

// Download thesis by id (students, faculty, pgc, admin)
router.get(
  '/download/:thesisId',
  protect,
  requireRole('Student', 'Faculty', 'PGC', 'Admin'),
  thesisController.downloadThesisPDF
);

// List theses (PGC/Faculty/Admin)
router.get('/', protect, requireRole('Faculty', 'PGC', 'Admin'), thesisController.listTheses);

module.exports = router;
