const axios = require('axios');
const { sendResponse } = require('../middlewares/common');
const logger = require('../utils/logger');
const {
  getGarminAuthUrl,
  getGarminAccessToken,getGarminUserId
} = require('../services/garminService');
const GarminAuthService = require('../dbMoelServices/garminDbService');



async function requestToken(req, res) {
  try {
    console.log(req.user, "test")
    if (!req.user || !req.user.user_id) {
      return sendResponse(res, "401", "Unauthorized", []);
    }

    const userId = req.user.user_id;
    const { authorize_url, state } = getGarminAuthUrl(userId);

    await GarminAuthService.storeGarminTempToken({
      userId,
      oauth_token: state,
      oauth_token_secret: null
    });

    return sendResponse(res, "200", "Redirect to Garmin", [{ authorize_url }]);
  } catch (err) {
    console.log(err)
    logger.error("Garmin request token error", err);
    return sendResponse(res, "500", "Garmin request failed", []);
  }
}

async function callback(req, res) {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return sendResponse(res, "400", "Missing OAuth parameters", { isConnected: false });
    }

    const tempToken = await GarminAuthService.getGarminTempToken(state);

    if (!tempToken || !tempToken.user_id) {
      return sendResponse(res, "400", "Invalid or expired session", { isConnected: false });
    }

    const accessResponse = await getGarminAccessToken(code, state);

    if (!accessResponse || !accessResponse.access_token) {
      return sendResponse(res, "400", "Garmin connection failed", { isConnected: false });
    }

    const { access_token, refresh_token, expires_in, garminUserId } = accessResponse;
    let {userId} = await getGarminUserId(access_token)
    
    let object = {
      userId: tempToken.user_id,
      access_token,
      access_token_secret: refresh_token,
      encoded_user_id: garminUserId,
      expires_in,
      is_connected: true,
      connected_at: new Date(),
      connected_garmin_user_id:userId
    }


    await GarminAuthService.saveGarminTokens(object);

    await GarminAuthService.deleteGarminTempToken(state);

    return sendResponse(res, "200", "Garmin connected successfully", accessResponse);
  } catch (err) {
    logger.error("Garmin callback error", err);
    return sendResponse(res, "500", "Garmin OAuth failed", { isConnected: false });
  }
}

async function ConnctedStatus(req, res) {
  try {
    const { user_id } = req.user;
    const data = await GarminAuthService.getConnectionStatus(user_id);

    if (!data) {
      return sendResponse(res, "200", "Garmin not connected", [{ isConnected: false }]);
    }

    return sendResponse(res, "200", "Garmin connection status", [{ isConnected: Boolean(data.is_connected) }]);
  } catch (err) {
    logger.error("Garmin connection status error", err);
    return sendResponse(res, "500", "Failed to fetch Garmin connection status", [{ isConnected: false }]);
  }
}


module.exports = {
  requestToken,
  callback,
  ConnctedStatus

};