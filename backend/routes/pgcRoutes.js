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

// supervision
router.post("/pgc-respond", protect, pgcRespond);
router.post("/pgc-manual-assign", protect, pgcManualAssign);
router.get("/supervision-requests", protect, getPGCSupervisionRequests);
router.get("/assigned-supervisors", protect, getPGCAssignedSupervisors);

// PGC user profile
router.get("/profile", protect, getPGCProfile);

// ✅ Thesis proposals (PGC)
router.get("/thesis-proposals", protect, listPGCThesisProposals);
// POST body: { proposalId, status: "Approved"|"Rejected"|"Comment", feedback? }
router.post("/thesis-proposals/review", protect, pgcReviewProposal);

module.exports = router;
