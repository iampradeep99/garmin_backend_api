const jwtService = require('../utils/jwt');
const { sendResponse } = require('./common');
const logger = require('../utils/logger');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendResponse(res, "401", "Authorization header missing", []);
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return sendResponse(res, "401", "Invalid authorization format", []);
    }

    const token = parts[1];

    if (!token) {
      return sendResponse(res, "401", "Token missing", []);
    }

    // 🔐 Verify token
    const decoded = await jwtService.verifyToken(token);

    if (!decoded || !decoded.user_id) {
      return sendResponse(res, "401", "Invalid or expired token", []);
    }

    // Attach user to request
    req.user = {
      user_id: decoded.user_id,
      fullname: decoded.fullname,
      email: decoded.email
    };

    return next();
  } catch (err) {
    logger.error('Auth middleware error', err);
    return sendResponse(res, "401", "Unauthorized", []);
  }
}

module.exports = {authMiddleware};
