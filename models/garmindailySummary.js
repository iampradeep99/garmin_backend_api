const mongoose = require('mongoose');

const GarminDailySummarySchema = new mongoose.Schema(
  {
    user_id: { type: Number, required: true, index: true },
    encoded_user_id: { type: String, required: true, index: true },

    calendar_date: { type: Date, required: true },

    activity_type: { type: String },

    active_kcal: { type: Number },
    bmr_kcal: { type: Number },

    steps: { type: Number },
    pushes: { type: Number },
    distance_meters: { type: Number },
    push_distance_meters: { type: Number },

    duration_seconds: { type: Number },
    active_time_seconds: { type: Number },
    start_time_seconds: { type: Number },
    start_time_offset_seconds: { type: Number },

    moderate_intensity_seconds: { type: Number },
    vigorous_intensity_seconds: { type: Number },

    floors_climbed: { type: Number },

    min_heart_rate: { type: Number },
    max_heart_rate: { type: Number },
    avg_heart_rate: { type: Number },
    resting_heart_rate: { type: Number },

    heart_rate_samples: { type: String },

    heart_rate_samples_array: [
      {
        offset: Number,
        value: Number
      }
    ],

    steps_goal: { type: Number },
    pushes_goal: { type: Number },
    intensity_goal_seconds: { type: Number },
    floors_goal: { type: Number },

    stress_avg: { type: Number },
    stress_max: { type: Number },
    stress_duration_seconds: { type: Number },
    rest_stress_duration_seconds: { type: Number },
    activity_stress_duration_seconds: { type: Number },
    low_stress_duration_seconds: { type: Number },
    medium_stress_duration_seconds: { type: Number },
    high_stress_duration_seconds: { type: Number },
    stress_qualifier: { type: String },

    body_battery_charged: { type: Number },
    body_battery_drained: { type: Number },

    source: { type: String },

    summary_id: { type: String, sparse: true }
  },
  {
    collection: 'garmin_daily_summary',
    timestamps: true
  }
);

GarminDailySummarySchema.index({ user_id: 1, calendar_date: 1 });

module.exports = mongoose.model('GarminDailySummary', GarminDailySummarySchema);