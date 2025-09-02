const express = require('express');
const router = express.Router();
const {
    pgcRespond,
    pgcManualAssign,
    pgcReviewProposal,
    getPGCSupervisionRequests,
    getPGCAssignedSupervisors,
    pendingProposals
} = require('../controllers/pgcController');
const { protect } = require('../middleware/authMiddleware');

router.post('/pgc-respond', pgcRespond);
router.post('/pgc-manual-assign', pgcManualAssign);
router.post('/pgc-review', pgcReviewProposal);
router.get('/supervision-requests', protect, getPGCSupervisionRequests);
router.get('/assigned-supervisors', protect, getPGCAssignedSupervisors);
router.get('/pending-proposals', protect, pendingProposals);

module.exports = router;