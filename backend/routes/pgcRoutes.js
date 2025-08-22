const express = require('express');
const router = express.Router();
const {
    pgcRespond,
    pgcManualAssign,
    pgcReviewProposal
} = require('../controllers/pgcController');


router.post('/pgc-respond', pgcRespond);
router.post('/pgc-manual-assign', pgcManualAssign);
router.post('/pgc-review', pgcReviewProposal);