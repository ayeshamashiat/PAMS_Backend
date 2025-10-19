const express = require("express");
const router = express.Router();
const {
  pgcRespond,
  pgcManualAssign,
  pgcReviewProposal,
  getPGCSupervisionRequests,
  getPGCAssignedSupervisors,
  getPGCProfile,
  getPendingProposals,
  getApprovedProposals,
  getPGCManualAssign,
  getAvailableSupervisors,
  assignSupervisorManually,
  getPGCManualAssignmentsWithSupervisors
} = require("../controllers/pgcController");
const { protect } = require("../middleware/authMiddleware");

router.post("/pgc-respond", pgcRespond);
router.post("/pgc-manual-assign", pgcManualAssign);
router.post("/pgc-review", pgcReviewProposal);
router.get("/supervision-requests", getPGCSupervisionRequests);
router.get("/assigned-supervisors", getPGCAssignedSupervisors);
router.get("/profile", protect, getPGCProfile);
router.get('/pending-proposals', getPendingProposals);
router.get('/approved-proposals', getApprovedProposals); 
router.get('/manual-assign-students', getPGCManualAssign);
router.post('/review-proposal', pgcReviewProposal);
router.get('/available-supervisors', getAvailableSupervisors);
router.post('/assign-supervisor', assignSupervisorManually);
router.get('/manual-assignments-with-supervisors', getPGCManualAssignmentsWithSupervisors);
module.exports = router;
