const crypto = require("crypto");
const axios = require("axios");
const qs = require("querystring");
const pkceStore = new Map();

function assertEnv() {
  const required = [
    "GARMIN_CLIENT_ID",
    "GARMIN_CLIENT_SECRET",
    "GARMIN_REDIRECT_URI"
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }
}

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(64).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

function getGarminAuthUrl(userId) {
    
  assertEnv();

  if (!userId) {
    throw new Error("userId is required to track the auth flow");
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  console.log(codeVerifier, "codeVerifier")
  const state = crypto.randomBytes(16).toString("hex");

  pkceStore.set(state, {
    codeVerifier,
    userId, 
    createdAt: Date.now()
  });

  const params = {
    response_type: "code",
    client_id: process.env.GARMIN_CLIENT_ID,
    redirect_uri: process.env.GARMIN_REDIRECT_URI,
    scope: "health:blood_pressure", 
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state
  };

  return {
    authorize_url: `https://connect.garmin.com/oauth2Confirm?${qs.stringify(params)}`,
    state
  };
}

async function getGarminAccessToken(code, state) {
  assertEnv();

  const entry = pkceStore.get(state);
  if (!entry) {
    throw new Error("Invalid or expired state");
  }

  pkceStore.delete(state);

  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.GARMIN_CLIENT_ID,
    client_secret: process.env.GARMIN_CLIENT_SECRET,
    code,
    code_verifier: entry.codeVerifier,
    redirect_uri: process.env.GARMIN_REDIRECT_URI
  });

  const response = await axios.post(
    "https://diauth.garmin.com/di-oauth2-service/oauth/token",
    payload.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000
    }
  );

  console.log(response)
const tokenExtraction = JSON.parse(atob(response.data.access_token.split('.')[1]));
  let garminID = tokenExtraction.garmin_guid
  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
    expires_in: response.data.expires_in,
    expires_at: Date.now() + (response.data.expires_in - 60) * 1000,
    scope: response.data.scope,
    garminUserId: garminID, 
    internalUserId: entry.userId 
  };
}

async function refreshGarminToken(refreshToken) {
  assertEnv();

  if (!refreshToken) {
    throw new Error("refreshToken is required");
  }

  const payload = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.GARMIN_CLIENT_ID,
    client_secret: process.env.GARMIN_CLIENT_SECRET,
    refresh_token: refreshToken
  });

  const response = await axios.post(
    "https://diauth.garmin.com/di-oauth2-service/oauth/token",
    payload.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000
    }
  );
const tokenExtraction = JSON.parse(atob(response.data.access_token.split('.')[1]));
  let garminID = tokenExtraction.garmin_guid
  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
    expires_in: response.data.expires_in,
    expires_at: Date.now() + (response.data.expires_in - 60) * 1000,
    scope: response.data.scope,
    garminUserId: garminID
  };
}



async function getGarminUserId(requestedAccessToken) {
  try {
    const response = await axios.get(
      `${process.env.GARMIN_BASE_URL}/user/id`,
      {
        headers: {
          Authorization: `Bearer ${requestedAccessToken}`
        }
      }
    );

    return response.data;
  } catch (err) {
    logger.error(
      "Garmin User ID Error",
      err.response?.data || err.message
    );
    throw err;
  }
}


module.exports = {
  getGarminAuthUrl,
  getGarminAccessToken,
  refreshGarminToken,
  getGarminUserId
};