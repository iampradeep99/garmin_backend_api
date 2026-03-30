const express = require('express');
const router = express.Router();
const {verifyGarminWebhook} = require('../middlewares/verifyGarminWebhook')


const {
 pushHeartRateEpoch,
 pushDailySummary, 
 pushBloodPressure
} = require('../controllers/garminPushController');


router.post('/heart-rate',  pushHeartRateEpoch);
router.post('/summary',  pushDailySummary);
router.post('/bp',  pushBloodPressure);

module.exports = router;
