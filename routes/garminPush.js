const express = require('express');
const router = express.Router();
const {verifyGarminWebhook} = require('../middlewares/verifyGarminWebhook')


const {
 pushHeartRateEpoch,
 pushDailySummary
} = require('../controllers/garminPushController');


// TODO: Re-enable middleware after testing
// router.post('/heart-rate', verifyGarminWebhook, pushHeartRateEpoch);
// router.post('/summary', verifyGarminWebhook, pushDailySummary);

router.post('/heart-rate', pushHeartRateEpoch);
router.post('/summary', pushDailySummary);


module.exports = router;
