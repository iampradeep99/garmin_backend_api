const { sendResponse } = require('../middlewares/common');
const jwtService = require('../utils/jwt');
const AppUser = require('../models/appUser');

function getAdminConfig() {
  return {
    email: process.env.ADMIN_EMAIL || 'admin@smartping.ai',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    name: process.env.ADMIN_NAME || 'Smartping Admin'
  };
}

async function adminLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    const adminConfig = getAdminConfig();

    if (!email || !password) {
      return sendResponse(res, '400', 'Email and password are required', []);
    }

    if (String(email).trim().toLowerCase() !== adminConfig.email.toLowerCase() || password !== adminConfig.password) {
      return sendResponse(res, '401', 'Invalid admin credentials', []);
    }

    const token = await jwtService.generateToken({
      admin_id: 'admin_001',
      role: 'admin',
      name: adminConfig.name,
      email: adminConfig.email
    });

    return sendResponse(res, '200', 'Admin login successful', [{
      token,
      admin: {
        name: adminConfig.name,
        email: adminConfig.email,
        role: 'admin'
      }
    }]);
  } catch (error) {
    return sendResponse(res, '500', 'Internal server error', []);
  }
}

async function adminProfile(req, res) {
  return sendResponse(res, '200', 'Admin profile fetched successfully', [{
    admin: req.admin
  }]);
}

async function listUsers(req, res) {
  try {
    const searchValue = String(req.query?.q || '').trim();
    const query = {};

    if (searchValue) {
      query.$or = [
        { fullname: { $regex: searchValue, $options: 'i' } },
        { email: { $regex: searchValue, $options: 'i' } },
        { mobile_number: { $regex: searchValue, $options: 'i' } }
      ];
    }

    const users = await AppUser.find(query)
      .select('-password -reset_password_token_hash -reset_password_expires_at -reset_password_requested_at -__v')
      .sort({ created_timestamp: -1 })
      .lean();

    const stats = {
      total_users: users.length,
      male_users: users.filter((user) => String(user.gender || '').toLowerCase() === 'male').length,
      female_users: users.filter((user) => String(user.gender || '').toLowerCase() === 'female').length,
      other_users: users.filter((user) => {
        const value = String(user.gender || '').toLowerCase();
        return value && value !== 'male' && value !== 'female';
      }).length
    };

    return sendResponse(res, '200', 'Users fetched successfully', [{
      stats,
      users
    }]);
  } catch (error) {
    return sendResponse(res, '500', 'Internal server error', []);
  }
}

module.exports = {
  adminLogin,
  adminProfile,
  listUsers
};
