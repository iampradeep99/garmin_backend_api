const express = require('express');
const { adminLogin, adminProfile, listUsers } = require('../controllers/adminController');
const { adminAuthMiddleware } = require('../middlewares/adminAuthMiddleware');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/me', adminAuthMiddleware, adminProfile);
router.get('/users', adminAuthMiddleware, listUsers);

module.exports = router;
