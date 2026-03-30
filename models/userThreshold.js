const mongoose = require('mongoose');

const UserThresholdSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    min_heart_rate: {
      type: Number,
    },
    max_heart_rate: {
      type: Number,
    },
    min_bp: {
      type: Number,
    },
    max_bp: {
      type: Number,
    },
    alert_email: {
      type: String,
      trim: true,
      lowercase: true
    },
    alert_mobile: {
      type: String,
      trim: true
    }
  },
  {
    collection: 'user_thresholds',
    timestamps: true
  }
);

module.exports = mongoose.model('UserThreshold', UserThresholdSchema);