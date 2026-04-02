const mongoose = require('mongoose');

const AlertJobSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
      index: true
    },
    metric_type: {
      type: String,
      enum: ['heart_rate', 'blood_pressure','spo2'],
      required: true,
      index: true
    },
    dedupe_key: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'retry', 'completed', 'failed', 'skipped'],
      default: 'pending',
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    max_attempts: {
      type: Number,
      default: 5
    },
    available_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    locked_at: {
      type: Date,
      default: null
    },
    locked_by: {
      type: String,
      default: null
    },
    last_error: {
      type: String,
      default: null
    },
    payload: {
      source: {
        type: String,
        default: null
      },
      source_ids: {
        type: [String],
        default: []
      },
      last_received_at: {
        type: Date,
        default: Date.now
      }
    }
  },
  {
    collection: 'alert_jobs',
    timestamps: true
  }
);

AlertJobSchema.index({ status: 1, available_at: 1 });
AlertJobSchema.index({ dedupe_key: 1, status: 1 });

module.exports = mongoose.model('AlertJob', AlertJobSchema);
