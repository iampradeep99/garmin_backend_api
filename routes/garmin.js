const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const {
  requestToken,callback,ConnctedStatus
 
} = require('../controllers/garminController');
const {
  checkEmail
 
} = require('../controllers/garminDataController');

//altaNewData
const {
  getSummary, getHeartRate, getBloodPressure
} = require('../controllers/garminDataController');

router.get('/request-token', authMiddleware, requestToken);
router.get('/callback', callback);
router.post('/connection-status', authMiddleware, ConnctedStatus);


router.get('/summary', authMiddleware, getSummary);
router.get('/heart-rate', authMiddleware, getHeartRate);
router.get('/bp', authMiddleware, getBloodPressure);

router.post('/checkEmail', checkEmail )



module.exports = router;