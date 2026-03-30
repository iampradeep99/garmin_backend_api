const { body } = require('express-validator');

const validateAddThreshold = [
  body('min_heart_rate')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Min heart rate must be a positive integer')
    .toInt(),

  body('max_heart_rate')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Max heart rate must be a positive integer')
    .toInt(),

  body('min_bp')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Min blood pressure must be a positive integer')
    .toInt(),

  body('max_bp')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Max blood pressure must be a positive integer')
    .toInt(),

  body('alert_email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Invalid email format'),

  body('alert_mobile')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN')
    .withMessage('Invalid mobile number')
];

const validateUpdateThreshold = [
  body('min_heart_rate')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .toInt(),

  body('max_heart_rate')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .toInt(),

  body('min_bp')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .toInt(),

  body('max_bp')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .toInt(),

  body('alert_email')
    .optional({ checkFalsy: true })
    .isEmail(),

  body('alert_mobile')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN')
];

module.exports = {
  validateAddThreshold,
  validateUpdateThreshold
};