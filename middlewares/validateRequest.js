const jwtService = require('../utils/jwt');
const { sendResponse } = require('./common');
const logger = require('../utils/logger');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;

    if (typeof authHeader !== 'string' || !authHeader.trim()) {
      return sendResponse(res, "401", "Authorization header missing or invalid", []);
    }

    const parts = authHeader.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return sendResponse(res, "401", "Invalid authorization format", []);
    }

    const token = parts[1];

    if (typeof token !== 'string' || !token.trim()) {
      return sendResponse(res, "401", "Token missing", []);
    }

    let decoded;
    try {
      decoded = await jwtService.verifyToken(token);
    } catch (e) {
      return sendResponse(res, "401", "Invalid or expired token", []);
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.user_id) {
      return sendResponse(res, "401", "Invalid or expired token", []);
    }

    req.user = {
      user_id: decoded.user_id,
      fullname: decoded.fullname || null,
      email: decoded.email || null
    };

    return next();
  } catch (err) {
    logger.error('Auth middleware error', err);
    return sendResponse(res, "401", "Unauthorized", []);
  }
}

module.exports = { authMiddleware };
