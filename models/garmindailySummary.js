const mongoose = require('mongoose');

const GarminDailySummarySchema = new mongoose.Schema(
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
    calendar_date: {
      type: Date,
      required: true
    },
    steps: {
      type: Number
    },
    distance_meters: {
      type: Number
    },
    active_kcal: {
      type: Number
    },
    bmr_kcal: {
      type: Number
    },
    avg_heart_rate: {
      type: Number
    },
    resting_heart_rate: {
      type: Number
    },
    stress_avg: {
      type: Number
    },
    stress_max: {
      type: Number
    },
    highest_heart_rate: { type: Number },
    avg_heartrate_day:  { type: Number },
    blood_pressure: {
      systolic:  { type: Number },
      diastolic: { type: Number },
      pulse:     { type: Number }
    },
    summary_id: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  {
    collection: 'garmin_daily_summary',
    timestamps: true
  }
);

GarminDailySummarySchema.index(
  { user_id: 1, calendar_date: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'GarminDailySummary',
  GarminDailySummarySchema
);
