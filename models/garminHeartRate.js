const mongoose = require('mongoose');

const GarminHeartRateSampleSchema = new mongoose.Schema(
  {
    // 🔑 USER IDENTIFICATION
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

    // 📅 DATE CONTEXT
    calendar_date: {
      type: Date,
      required: true,
      index: true
    },

    // ❤️ HEART RATE DATA
    offset: {
      type: Number,
      required: true
    },
    heart_rate: {
      type: Number,
      required: true
    },

    // 🔗 TRACEABILITY
    summary_id: {
      type: String,
      index: true
    },

    // 📡 SOURCE (optional but useful)
    source: {
      type: String
    }
  },
  {
    collection: 'garmin_heart_rate_samples',
    timestamps: true
  }
);



module.exports = mongoose.model(
  'GarminHeartRateSample',
  GarminHeartRateSampleSchema
);