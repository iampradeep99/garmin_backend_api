const mongoose = require('mongoose');

const GarminHeartRateSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
      index: true
    },
    encoded_user_id: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    heart_rate: {
      type: Number,
      min: 1,
      required: true
    },
    timestamp_time: {
      type: String
    },
    date: {
      type: String,
    },
    insertedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'garmin_user_heart_rates',
    timestamps: true
  }
);

module.exports = mongoose.model('GarminHeartRate', GarminHeartRateSchema);