// routes/studentRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect } = require("../middleware/authMiddleware");

const {
  getStudentProfile,
  submitThesisProposal,
  getStudentProgress,
  getStudentCourses,
  getResult,
  checkSupervisorEligibility,
  checkAssignmentStatus,
  getMyProposal,
  downloadProposalPDF,
} = require("../controllers/studentController");

const {
  submitThesis,
  getMyThesis,
  downloadThesisPDF,
} = require("../controllers/thesisSubmissionController");

// profile / courses / result
router.get("/profile", protect, getStudentProfile);
router.get("/courses", protect, getStudentCourses);
router.get("/result", protect, getResult);
router.get("/progress", protect, getStudentProgress);
// supervisor assignment
router.get(
  "/supervisor-assignment/check-eligibility",
  protect,
  checkSupervisorEligibility
);
router.get("/assignment/check-status", protect, checkAssignmentStatus);

// proposal
router.post(
  "/submit/check",
  protect,
  upload.single("attachment"),
  submitThesisProposal
);
router.get("/my-proposal", protect, getMyProposal);
router.get("/proposal-pdf/:proposalId", protect, downloadProposalPDF);

// thesis
router.post(
  "/thesis/submit",
  protect,
  upload.single("attachment"),
  submitThesis
);
router.get("/my-thesis", protect, getMyThesis);
router.get("/thesis-pdf/:id", protect, downloadThesisPDF);

module.exports = router;
