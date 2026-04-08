const express = require('express');
const router = express.Router();
const {verifyGarminWebhook} = require('../middlewares/verifyGarminWebhook')


const {
 pushHeartRateEpoch,
 pushDailySummary,
 summaryDetails
} = require('../controllers/garminPushController');


// TODO: Re-enable middleware after testing


router.post('/heart-rate', pushHeartRateEpoch);
router.post('/summary', pushDailySummary);
router.post('/checkSummary', summaryDetails )


module.exports = router;
