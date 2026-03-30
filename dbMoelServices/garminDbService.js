const GarminAuth = require('../models/garminAuthModel');

async function storeGarminTempToken({
  userId,
  oauth_token,
  oauth_token_secret
}) {
  return await GarminAuth.updateOne(
    { user_id: userId },
    {
      $set: {
        oauth_token,
        oauth_token_secret,
        updated_timestamp: new Date()
      },
      $setOnInsert: {
        user_id: userId,
        access_token: null,
        access_token_secret: null,
        encoded_user_id: null,
        expires_in: null,
        connected_at: null,
        is_connected: false,
        created_timestamp: new Date()
      }
    },
    { upsert: true }
  );
}

async function getGarminTempToken(oauth_token) {
  return await GarminAuth.findOne(
    { oauth_token },
    {
      user_id: 1,
      oauth_token_secret: 1,
      _id: 0
    }
  ).lean();
}

async function saveGarminTokens({
  userId,
  access_token,
  access_token_secret,
  encoded_user_id,
  expires_in,
  is_connected,
  connected_at,
  connected_garmin_user_id
}) {
  return await GarminAuth.updateOne(
    { user_id: userId },
    {
      $set: {
        access_token,
        access_token_secret,
        encoded_user_id,
        expires_in,
        is_connected: Boolean(is_connected),
        connected_at: connected_at || new Date(),
        oauth_token: null,
        oauth_token_secret: null,
        updated_timestamp: new Date(),
        connected_garmin_user_id
      }
    }
  );
}

async function deleteGarminTempToken(oauth_token) {
  return await GarminAuth.updateOne(
    { oauth_token },
    {
      $set: {
        oauth_token: null,
        oauth_token_secret: null,
        updated_timestamp: new Date()
      }
    }
  );
}

async function disconnectGarmin(userId) {
  return await GarminAuth.deleteOne({ user_id: userId });
}

async function getConnectionStatus(userId) {
  return await GarminAuth.findOne(
    { user_id: userId },
    {
      user_id: 1,
      is_connected: 1,
      _id: 0
    }
  ).lean();
}

module.exports = {
  storeGarminTempToken,
  getGarminTempToken,
  saveGarminTokens,
  deleteGarminTempToken,
  disconnectGarmin,
  getConnectionStatus
};
