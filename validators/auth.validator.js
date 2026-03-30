const { body } = require("express-validator");

exports.registerValidator = [
  body("fullname")
    .isLength({ min: 2 })
    .withMessage("Fullname must be at least 2 characters")
    .trim(),

  body("mobile_number")
    .isMobilePhone("en-IN")
    .withMessage("Valid mobile number required"),

  body("email")
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),

  body("dob")
    .isISO8601()
    .withMessage("Date of birth must be valid ISO date"),

  body("gender")
    .isIn(["M", "F", "O"])
    .withMessage("Gender must be M, F, or O"),

  body("height_cm")
    .isFloat({ min: 50, max: 250 })
    .withMessage("Height must be between 50-250 cm"),

  body("weight_kg")
    .isFloat({ min: 20, max: 500 })
    .withMessage("Weight must be between 20-500 kg"),
  
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

exports.loginValidator = [
  body("email")
    .isEmail()
    .withMessage("Must be a valid email"),
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];