const mongoose = require('mongoose');

const GarminUserMetricsSchema = new mongoose.Schema(
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
    summary_id: {
      type: String,
      required: true,
      unique: true
    },
    calendar_date: {
      type: Date,
      required: true
    },
    vo2_max: {
      type: Number,
      default: null
    },
    vo2_max_cycling: {
      type: Number,
      default: null
    },
    fitness_age: {
      type: Number,
      default: null
    },
    enhanced: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('GarminUserMetrics', GarminUserMetricsSchema);