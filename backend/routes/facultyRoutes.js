const express = require("express");
const router = express.Router();
const {
  getSupervisedStudents,
  getPendingSupervisorRequests,
  supervisorRespond,
  getSupervisionQuota,
  getProposalsFromSupervisedStudents,
  reviewThesisProposal,
  getAcceptedSupervisionStudents,
  getFacultyProfile,
} = require("../controllers/facultyController");
const {
  listForSupervisor,
  supervisorReview,
} = require("../controllers/thesisSubmissionController");
const { protect } = require("../middleware/authMiddleware");

router.get("/profile", protect, getFacultyProfile);

// View supervised students (with thesis info)
router.get("/supervised-students", protect, getSupervisedStudents);

// View pending supervisor requests (priority list)
router.get("/supervisor-requests", protect, getPendingSupervisorRequests);

// Accept/reject supervisor requests
router.post("/supervisor-respond", protect, supervisorRespond);

// View supervision quota/load
router.get("/supervision-quota", protect, getSupervisionQuota);

// View thesis proposals from supervised students
router.get("/thesis-proposals", protect, getProposalsFromSupervisedStudents);

// Review thesis proposal (give feedback, approve, request revision)
router.post("/thesis-proposal/review", protect, reviewThesisProposal);

// View accepted students for supervision
router.get(
  "/accepted-supervision-students",
  protect,
  getAcceptedSupervisionStudents
);

router.get("/thesis-submissions", protect, listForSupervisor);
router.post("/thesis-submission/review", protect, supervisorReview);

module.exports = router;
