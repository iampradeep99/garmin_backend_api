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
      index: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    heart_rate: {
  type: Number,
  required: true,
  min: 1
},
    source: {
      type: String,
      enum: ['epoch', 'daily'],
      default: 'epoch'
    }
  },
  {
    collection: 'garmin_heart_rate',
    timestamps: true
  }
);

GarminHeartRateSchema.index(
  { user_id: 1, timestamp: 1 }
);

module.exports = mongoose.model(
  'GarminHeartRate',
  GarminHeartRateSchema
);
