const mongoose = require('mongoose');

const GarminHeartRateSchema = new mongoose.Schema(
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

    // 🕒 CORE TIME FIELD (MOST IMPORTANT)
    timestamp: {
      type: Number, // UNIX timestamp (seconds)
      required: true,
      index: true
    },

    // ❤️ HEART RATE
    heart_rate: {
      type: Number,
      min: 1,
      required: true
    },

    // 📅 CONTEXT
    calendar_date: {
      type: String, // "YYYY-MM-DD"
      index: true
    },

    // 🔗 SUMMARY LINKING
    summary_id: {
      type: String,
      index: true
    },

    duration_in_seconds: {
      type: Number
    },

    start_time_offset_in_seconds: {
      type: Number
    },

    // 📊 SUMMARY STATS
    min_heart_rate: {
      type: Number
    },
    max_heart_rate: {
      type: Number
    },

    // 🧾 RAW STORAGE
    epoch_summaries: {
      type: String
    },

    // ⚡ STRUCTURED ARRAY (optional but powerful)
    epoch_summary_array: [
      {
        second: Number,
        minute: Number,
        heart_rate: Number,
        timestamp: Number
      }
    ],

    // 📦 FULL PAYLOAD (DEBUGGING / TRACE)
    raw_payload: {
      type: Object
    },

    // 📡 SOURCE TRACKING
    source: {
      type: String,
      enum: ['epoch', 'daily', 'summary'],
      default: 'summary',
      index: true
    }
  },
  {
    collection: 'garmin_user_heart_rates',
    timestamps: true
  }
);


// 🔥 MOST IMPORTANT (duplicate prevention)
GarminHeartRateSchema.index(
  { user_id: 1, timestamp: 1 },
  { unique: true }
);


// ⚡ PERFORMANCE INDEXES


module.exports = mongoose.model(
  'GarminHeartRate',   // ✅ correct model name
  GarminHeartRateSchema
);