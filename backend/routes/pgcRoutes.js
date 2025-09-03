// routes/pgcRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const {
  pgcRespond,
  pgcManualAssign,
  pgcReviewProposal,
  listPGCThesisProposals,
  getPGCSupervisionRequests,
  getPGCAssignedSupervisors,
  getPGCProfile,
} = require("../controllers/pgcController");

const {
  pgcList,
  pgcReview,
} = require("../controllers/thesisSubmissionController");

// profile/supervision management
router.get("/profile", protect, getPGCProfile);
router.post("/pgc-respond", protect, pgcRespond);
router.post("/pgc-manual-assign", protect, pgcManualAssign);
router.get("/supervision-requests", protect, getPGCSupervisionRequests);
router.get("/assigned-supervisors", protect, getPGCAssignedSupervisors);

// thesis proposals (PGC)
router.get("/thesis-proposals", protect, listPGCThesisProposals);
router.post("/thesis-proposals/review", protect, pgcReviewProposal);

// thesis submissions (PGC final approval)
// Pending for PGC
router.get("/theses/pending", protect, (req, res, next) => {
  req.query.status = "Approved";
  return pgcList(req, res, next);
});
// Already approved by PGC
router.get("/theses/approved", protect, (req, res, next) => {
  req.query.status = "PGCApproved";
  return pgcList(req, res, next);
});
// Already rejected by PGC
router.get("/theses/rejected", protect, (req, res, next) => {
  req.query.status = "PGCRejected";
  return pgcList(req, res, next);
});
// Generic filter (kept)
router.get("/theses", protect, pgcList);
router.post("/theses/review", protect, pgcReview);

module.exports = router;
