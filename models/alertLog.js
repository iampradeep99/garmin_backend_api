const mongoose = require('mongoose');

const AlertLogSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true
  },
  email: {
    type: String,
    default: null
  },
  mobile: {
    type: String,
    default: null
  },
  message: {
    type: String,
    required: true
  },
  alert_type: {
    type: String,
    default: null
  },
  alert_key: {
    type: String,
    default: null,
    index: true
  },
  source_metric: {
    type: String,
    default: null
  },
  job_id: {
    type: String,
    default: null
  },
  reference_id: {
    type: String,
    default: null
  },
  email_sent: {
    type: Boolean,
    default: false
  },
  sms_sent: {
    type: Boolean,
    default: false
  },
  delivery_status: {
    type: String,
    enum: ["BOTH_SENT", "EMAIL_ONLY", "SMS_ONLY", "FAILED"],
    default: "FAILED"
  },
  email_error: {
    type: String,
    default: null
  },
  sms_error: {
    type: String,
    default: null
  },
  sms_response: {
    type: Object,
    default: null
  },
  email_response: {
    type: Object,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

AlertLogSchema.index({ user_id: 1, alert_key: 1, createdAt: -1 });

module.exports = mongoose.model('AlertLog', AlertLogSchema);
