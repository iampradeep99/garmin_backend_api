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

    // ✅ Core fields (system use)
    timestamp: {
      type: Number,
      required: true
    },
    heart_rate: {
      type: Number,
      required: false,
      min: 1
    },

    // ✅ Garmin fields
    summary_id: {
      type: String
    },
    calendar_date: {
      type: String
    },
    duration_in_seconds: {
      type: Number
    },
    start_time_offset_in_seconds: {
      type: Number
    },

    // ✅ Summary details
    min_heart_rate: {
      type: Number
    },
    max_heart_rate: {
      type: Number
    },
    epoch_summaries: {
      type: String
    },
    epoch_summary_array: [
  {
    second: Number,
    minute: Number,
    heart_rate: Number,
    timestamp: Number
  }
],

    // ✅ Full raw payload
    raw_payload: {
      type: Object
    },

    source: {
      type: String,
      enum: ['epoch', 'daily', 'summary'],
      default: 'summary'
    }
  },
  {
    collection: 'garmin_heart_rate',
    timestamps: true
  }
);

// ✅ Index (same as your original)
GarminHeartRateSchema.index(
  { user_id: 1, timestamp: 1 }
);

module.exports = mongoose.model(
  'GarminHeartRate',
  GarminHeartRateSchema
);