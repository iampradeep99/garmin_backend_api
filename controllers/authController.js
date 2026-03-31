const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { sendResponse, generate10DigitId } = require('../middlewares/common');
const logger = require('../utils/logger');
const jwtService = require('../utils/jwt');
const AppUser = require('../models/appUser');
const { sendPasswordResetEmail } = require('../common/passwordResetMail');

const PASSWORD_RESET_TOKEN_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || '15', 10);

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

async function forgotPassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendResponse(res, "400", errors.array()[0].msg, []);
    }

    const { email } = req.body;
    const user = await AppUser.findOne({ email });
    console.log(user)
    if (!user) {
      logger.warn(`Forgot password requested for unregistered email: ${email}`);
      return sendResponse(res, "200", "If the email is registered, a password reset token has been sent", []);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    user.reset_password_token_hash = tokenHash;
    user.reset_password_expires_at = expiresAt;
    user.reset_password_requested_at = new Date();
    await user.save();

    const mailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.fullname || 'User',
      token,
      expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES
    });

    if (!mailResult.success) {
      user.reset_password_token_hash = null;
      user.reset_password_expires_at = null;
      user.reset_password_requested_at = null;
      await user.save();
      logger.error(`Forgot password email failed for ${user.email}: ${mailResult.error}`);
    } else {
      logger.info(`Forgot password email sent successfully to ${user.email}`);
    }

    return sendResponse(res, "200", "If the email is registered, a password reset token has been sent", []);
  } catch (err) {
    logger.error("Forgot password error", err);
    return sendResponse(res, "500", "Internal server error", []);
  }
}

async function resetPassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendResponse(res, "400", errors.array()[0].msg, []);
    }

    const { token, new_password } = req.body;
    const tokenHash = hashResetToken(token);

    const user = await AppUser.findOne({
      reset_password_token_hash: tokenHash,
      reset_password_expires_at: { $gte: new Date() }
    });

    if (!user) {
      return sendResponse(res, "400", "Invalid or expired reset token", []);
    }

    user.password = await bcrypt.hash(new_password, 10);
    user.reset_password_token_hash = null;
    user.reset_password_expires_at = null;
    user.reset_password_requested_at = null;
    await user.save();

    return sendResponse(res, "200", "Password reset successful", []);
  } catch (err) {
    logger.error("Reset password error", err);
    return sendResponse(res, "500", "Internal server error", []);
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};
