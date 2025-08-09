const express = require('express');
const router = express.Router();
const {
    getSupervisedStudents,
    getPendingSupervisorRequests,
    supervisorRespond,
    getSupervisionQuota,
    getProposalsFromSupervisedStudents,
    reviewThesisProposal
} = require('../controllers/facultyController');
const { protect } = require('../middleware/authMiddleware');

// View supervised students (with thesis info)
router.get('/supervised-students', getSupervisedStudents);

// View pending supervisor requests (priority list)
router.get('/supervisor-requests', protect, getPendingSupervisorRequests);

// Accept/reject supervisor requests
router.post('/supervisor-respond', supervisorRespond);

// View supervision quota/load
router.get('/supervision-quota', getSupervisionQuota);

// View thesis proposals from supervised students
router.get('/thesis-proposals', getProposalsFromSupervisedStudents);

// Review thesis proposal (give feedback, approve, request revision)
router.post('/thesis-proposal/review', reviewThesisProposal);

module.exports = router;