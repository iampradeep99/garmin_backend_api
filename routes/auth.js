const express = require("express");
const router = express.Router();

const {login,register} = require("../controllers/authController");
const { registerValidator , loginValidator } = require("../validators/auth.validator");

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

module.exports = router;
