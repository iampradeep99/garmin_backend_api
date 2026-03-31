const jwtService = require('../utils/jwt');
const { sendResponse } = require('./common');

async function adminAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;

    if (typeof authHeader !== 'string' || !authHeader.trim()) {
      return sendResponse(res, '401', 'Authorization header missing or invalid', []);
    }

    const parts = authHeader.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return sendResponse(res, '401', 'Invalid authorization format', []);
    }

    const token = parts[1];
    const decoded = await jwtService.verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
      return sendResponse(res, '403', 'Admin access required', []);
    }

    req.admin = {
      admin_id: decoded.admin_id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    };

    return next();
  } catch (error) {
    return sendResponse(res, '401', 'Unauthorized', []);
  }
}

module.exports = {
  adminAuthMiddleware
};
