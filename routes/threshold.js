const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { addThreshold, updateThreshold, getThreshold } = require('../controllers/thresholdController');
const { validateAddThreshold, validateUpdateThreshold } = require('../validators/thresholdValidator');

// All threshold routes require authentication
router.use(authMiddleware);

router.post('/', validateAddThreshold, addThreshold);
router.put('/', validateUpdateThreshold, updateThreshold);
router.get('/', getThreshold);

module.exports = router;