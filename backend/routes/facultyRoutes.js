const express = require("express");
const router = express.Router();

const {
  getSupervisedStudents,
  getPendingSupervisorRequests,
  supervisorRespond,
  getSupervisionQuota,
  getProposalsFromSupervisedStudents, // proposal workflow (separate)
  reviewThesisProposal, // proposal workflow (separate)
  getAcceptedSupervisionStudents,
  getFacultyProfile,
} = require("../controllers/facultyController");

const {
  listForSupervisor, // thesis submission list (supervisor’s students)
  supervisorReview, // thesis submission review (approve/reject/comment)
} = require("../controllers/thesisSubmissionController");

const { protect } = require("../middleware/authMiddleware");

// Profile
router.get("/profile", protect, getFacultyProfile);

// Supervisor assignment views / actions
router.get("/supervised-students", protect, getSupervisedStudents);
router.get("/supervisor-requests", protect, getPendingSupervisorRequests);
router.post("/supervisor-respond", protect, supervisorRespond);
router.get("/supervision-quota", protect, getSupervisionQuota);
router.get(
  "/accepted-supervision-students",
  protect,
  getAcceptedSupervisionStudents
);

// ---------- Thesis *proposal* workflow (separate from thesis submission) ----------
router.get("/thesis-proposals", protect, getProposalsFromSupervisedStudents);
router.post("/thesis-proposal/review", protect, reviewThesisProposal);

// ---------- Thesis *submission* workflow (matches your faculty approvals UI) ----------
// UI loads one of these; all return the same list. Accepts ?status=Submitted (optional)
router.get("/thesis-submissions", protect, listForSupervisor);
router.get("/proposals-from-supervised", protect, listForSupervisor); // alias kept for UI
router.get("/proposals-from-supervised-students", protect, listForSupervisor); // alias kept for UI
router.get("/proposals", protect, listForSupervisor); // alias kept for UI

// UI posts to /faculty/review-proposal with { proposalId, status, feedback? }.
// We alias proposalId -> submissionId for the thesis workflow and forward.
router.post("/review-proposal", protect, (req, res, next) => {
  if (req.body.proposalId && !req.body.submissionId) {
    req.body.submissionId = req.body.proposalId; // alias for thesis submissions
  }
  return supervisorReview(req, res, next);
});

// Also expose explicit thesis review endpoint if you want to call it directly
router.post("/thesis-submission/review", protect, supervisorReview);

module.exports = router;
