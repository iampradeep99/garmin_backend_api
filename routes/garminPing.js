const express = require('express');

const {
  pingHeartRateEpoch,
  pingDailySummary,
  pingBloodPressure
} = require('../controllers/garminPingController');

const router = express.Router();

router.post('/heart-rate', pingHeartRateEpoch);
router.post('/summary', pingDailySummary);
router.post('/bp', pingBloodPressure);

module.exports = router;
