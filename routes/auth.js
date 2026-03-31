const express = require("express");
const router = express.Router();

const {
  login,
  register,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} = require("../validators/auth.validator");

router.post(
  "/register",
  registerValidator,
  
  register
);

router.post(
  "/login",
  loginValidator,
 
login
);

router.post(
  "/forgot-password",
  forgotPasswordValidator,
  forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordValidator,
  resetPassword
);

module.exports = router;
