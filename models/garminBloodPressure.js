const mongoose = require('mongoose');

const GarminSpo2Schema = new mongoose.Schema(
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
      unique: true,
      sparse: true
    },

    calendar_date: {
      type: String
    },

    start_time: {
      type: Number,
      required: true
    },

    duration: {
      type: Number
    },

    offset: {
      type: Number
    },

    on_demand: {
      type: Boolean
    },

    // ✅ ORIGINAL STRING (as received)
    spo2_string: {
      type: String
    },

    // ✅ PARSED ARRAY (for queries / analytics)
    spo2_array: [
      {
        offset: {
          type: Number
        },
        value: {
          type: Number
        }
      }
    ]
  },
  {
    collection: 'garmin_spo2',
    timestamps: true
  }
);

module.exports = mongoose.model('GarminSpo2', GarminSpo2Schema);