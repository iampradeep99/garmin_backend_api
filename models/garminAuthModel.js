const mongoose = require('mongoose');

const GarminAuthSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
      unique: true
    },
    oauth_token: {
      type: String
    },
    oauth_token_secret: {
      type: String
    },
    access_token: {
      type: String
    },
    access_token_secret: {
      type: String
    },
    encoded_user_id: {
      type: String
    },
    expires_in: {
      type: Number
    },
    connected_at: {
      type: Date
    },
    is_connected: {
      type: Boolean,
      default: false
    },
    connected_garmin_user_id:{
         type: String
    }
  },
  {
    collection: 'garmin_auth',
    timestamps: {
      createdAt: 'created_timestamp',
      updatedAt: 'updated_timestamp'
    }
  }
);

module.exports = mongoose.model('GarminAuth', GarminAuthSchema);
