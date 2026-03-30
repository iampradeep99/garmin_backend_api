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
    type: String, // BP, HR, or both
    default: null
  },

  reference_id: {
    type: String,
    default: null
  },

  // ===== DELIVERY STATUS =====
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

  // ===== ERROR TRACKING =====
  email_error: {
    type: String,
    default: null
  },

  sms_error: {
    type: String,
    default: null
  },

  // ===== EXTRA DEBUG INFO (OPTIONAL) =====
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

module.exports = mongoose.model('AlertLog', AlertLogSchema);