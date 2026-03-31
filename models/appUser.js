const mongoose = require('mongoose');

const AppUserSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      unique: true
    },
    fullname: {
      type: String
    },
    mobile_number: {
      type: String
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    dob: {
      type: Date
    },
    gender: {
      type: String
    },
    height_cm: {
      type: Number
    },
    weight_kg: {
      type: Number
    },
    password: {
      type: String,
      required: true
    },
    reset_password_token_hash: {
      type: String,
      default: null
    },
    reset_password_expires_at: {
      type: Date,
      default: null
    },
    reset_password_requested_at: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'app_user',
    timestamps: {
      createdAt: 'created_timestamp',
      updatedAt: 'updated_timestamp'
    }
  }
);

module.exports = mongoose.model('AppUser', AppUserSchema);
