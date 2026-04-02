const express = require('express');
const router = express.Router();
const {verifyGarminWebhook} = require('../middlewares/verifyGarminWebhook')


const {
 pushHeartRateEpoch,
 pushDailySummary, 
 pulseOx,
 userMetrics
} = require('../controllers/garminPushController');


router.post('/heart-rate',  pushHeartRateEpoch);
router.post('/summary',  pushDailySummary);
router.post('/spo2',  pulseOx);
router.post('/userMetrics',userMetrics)

module.exports = router;
