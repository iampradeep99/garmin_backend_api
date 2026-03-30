const mongoose = require('mongoose');

const GarminBloodPressureSchema = new mongoose.Schema(
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
    measurement_time: {
      type: Number,
      required: true
    },
    systolic: {
      type: Number,
      required: true
    },
    diastolic: {
      type: Number,
      required: true
    },
    pulse: {
      type: Number
    },
    summary_id: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  {
    collection: 'garmin_blood_pressure',
    timestamps: true
  }
);

module.exports = mongoose.model(
  'GarminBloodPressure',
  GarminBloodPressureSchema
);
