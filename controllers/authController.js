const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { sendResponse, generate10DigitId } = require('../middlewares/common');
const logger = require('../utils/logger');
const jwtService = require('../utils/jwt');
const AppUser = require('../models/appUser');

async function register(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendResponse(res, "400", errors.array()[0].msg, []);
    }

    const user_id = await generate10DigitId();

    const {
      fullname,
      mobile_number,
      email,
      dob,
      gender,
      height_cm,
      weight_kg,
      password
    } = req.body;

    const existingEmail = await AppUser.findOne({ email }).lean();
    if (existingEmail) {
      return sendResponse(res, "400", "Email already in use", []);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await AppUser.create({
      user_id,
      fullname,
      mobile_number,
      email,
      dob: dob ? new Date(dob) : null,
      gender,
      height_cm: Number(height_cm),
      weight_kg: Number(weight_kg),
      password: hashedPassword
    });

    return sendResponse(res, "200", "User created", [{
      user_id: user.user_id,
      fullname: user.fullname,
      email: user.email
    }]);
  } catch (err) {
    logger.error("Registration error", err);
    return sendResponse(res, "500", "Internal server error", []);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await AppUser.findOne({ email }).lean();
    if (!user) {
      return sendResponse(res, "401", "Invalid email or password", []);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return sendResponse(res, "401", "Invalid email or password", []);
    }

    const token = await jwtService.generateToken({
      user_id: user.user_id,
      fullname: user.fullname,
      email: user.email
    });

    return sendResponse(res, "200", "Login successful", [{
      token
    }]);
  } catch (err) {
    logger.error("Login error", err);
    return sendResponse(res, "500", "Internal server error", []);
  }
}

module.exports = {
  register,
  login
};
