const axios = require('axios');

const logger = require('../utils/logger');
const GarminAuth = require('../models/garminAuthModel');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminDailySummary = require('../models/garmindailySummary');
const { refreshGarminToken } = require('../services/garminService');
const { sendGarminAlertEmail } = require('../common/garminAlertMail');
const { enqueueAlertJob } = require('../services/alertJobService');

function formatDateTime(value = new Date()) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function normalizeNotifications(payload) {
  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }

  if (Array.isArray(payload?.notifications)) {
    return payload.notifications.filter(Boolean);
  }

  if (payload && typeof payload === 'object' && Object.keys(payload).length) {
    return [payload];
  }

  return [];
}

function buildMeta(req, pingType, notifications) {
  const userIds = notifications
    .map((item) => item?.userId)
    .filter(Boolean)
    .slice(0, 5);

  return {
    pingType,
    count: notifications.length,
    userIds,
    endpoint: req.originalUrl,
    method: req.method,
    ip: req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown',
    receivedAt: formatDateTime()
  };
}

function buildAlertHtml(title, meta, details = '') {
  const userIdText = meta.userIds.length ? meta.userIds.join(', ') : 'No userId found';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
      <h2 style="margin-bottom: 12px;">${title}</h2>
      <p><strong>Ping Type:</strong> ${meta.pingType}</p>
      <p><strong>Notifications:</strong> ${meta.count}</p>
      <p><strong>Endpoint:</strong> ${meta.endpoint}</p>
      <p><strong>Method:</strong> ${meta.method}</p>
      <p><strong>IP:</strong> ${meta.ip}</p>
      <p><strong>Received At:</strong> ${meta.receivedAt}</p>
      <p><strong>User IDs:</strong> ${userIdText}</p>
      ${details ? `<p><strong>Details:</strong> ${details}</p>` : ''}
    </div>
  `;
}

async function sendPingReceivedAlert(req, pingType, notifications) {
  const meta = buildMeta(req, pingType, notifications);
  const userIdText = meta.userIds.length ? meta.userIds.join(', ') : 'No userId found';
  const text = [
    'Garmin ping request received successfully.',
    `Ping Type: ${meta.pingType}`,
    `Notifications: ${meta.count}`,
    `Endpoint: ${meta.endpoint}`,
    `Method: ${meta.method}`,
    `IP: ${meta.ip}`,
    `Received At: ${meta.receivedAt}`,
    `User IDs: ${userIdText}`
  ].join('\n');

  const result = await sendGarminAlertEmail({
    subject: `Garmin Ping Received - ${pingType}`,
    text,
    html: buildAlertHtml('Garmin ping request received successfully.', meta)
  });

  if (!result.success) {
    logger.warn(`Garmin ping received email failed: ${result.error}`);
  }
}

async function sendPingErrorAlert(req, pingType, notifications, error) {
  const meta = buildMeta(req, pingType, notifications);
  const userIdText = meta.userIds.length ? meta.userIds.join(', ') : 'No userId found';
  const errorMessage = error?.stack || error?.message || String(error);
  const text = [
    'Garmin ping request failed while processing.',
    `Ping Type: ${meta.pingType}`,
    `Notifications: ${meta.count}`,
    `Endpoint: ${meta.endpoint}`,
    `Method: ${meta.method}`,
    `IP: ${meta.ip}`,
    `Received At: ${meta.receivedAt}`,
    `User IDs: ${userIdText}`,
    `Error: ${errorMessage}`
  ].join('\n');

  const result = await sendGarminAlertEmail({
    subject: `Garmin Ping Error - ${pingType}`,
    text,
    html: buildAlertHtml('Garmin ping request failed while processing.', meta, errorMessage)
  });

  if (!result.success) {
    logger.warn(`Garmin ping error email failed: ${result.error}`);
  }
}

async function findAuthRecord({ encodedUserId, userAccessToken }) {
  const orConditions = [];

  if (encodedUserId) {
    orConditions.push({ encoded_user_id: encodedUserId });
    orConditions.push({ connected_garmin_user_id: encodedUserId });
  }

  if (userAccessToken) {
    orConditions.push({ access_token: userAccessToken });
  }

  if (!orConditions.length) {
    return null;
  }

  return GarminAuth.findOne({
    $or: orConditions,
    is_connected: true
  });
}

function getAccessToken(notification, authRecord) {
  return notification?.userAccessToken || authRecord?.access_token || null;
}

async function refreshAccessTokenIfNeeded(authRecord) {
  if (!authRecord?.access_token_secret) {
    return null;
  }

  const refreshed = await refreshGarminToken(authRecord.access_token_secret);

  authRecord.access_token = refreshed.access_token;
  authRecord.access_token_secret = refreshed.refresh_token;
  authRecord.expires_in = refreshed.expires_in;
  authRecord.updated_timestamp = new Date();
  await authRecord.save();

  return refreshed.access_token;
}

async function fetchCallbackData(callbackURL, accessToken) {
  const response = await axios.get(callbackURL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    timeout: 20000
  });

  return response.data;
}

async function fetchCallbackDataWithRetry(notification, authRecord) {
  const callbackURL = notification?.callbackURL || notification?.callbackUrl;

  if (!callbackURL) {
    throw new Error('callbackURL is missing in ping payload');
  }

  let accessToken = getAccessToken(notification, authRecord);

  if (!accessToken) {
    throw new Error('No access token available for callback fetch');
  }

  try {
    return await fetchCallbackData(callbackURL, accessToken);
  } catch (error) {
    if (error?.response?.status !== 401 || !authRecord) {
      throw error;
    }

    const refreshedToken = await refreshAccessTokenIfNeeded(authRecord);

    if (!refreshedToken) {
      throw error;
    }

    return fetchCallbackData(callbackURL, refreshedToken);
  }
}

function extractRecords(callbackData, key) {
  if (Array.isArray(callbackData)) {
    return callbackData;
  }

  if (Array.isArray(callbackData?.[key])) {
    return callbackData[key];
  }

  if (callbackData && typeof callbackData === 'object' && Object.keys(callbackData).length) {
    return [callbackData];
  }

  return [];
}

async function storeHeartRateRecords(records, authRecord) {
  const sourceIds = [];

  for (const record of records) {
    const created = await GarminHeartRate.create({
      user_id: authRecord.user_id,
      encoded_user_id: record.userId || authRecord.encoded_user_id || authRecord.connected_garmin_user_id,
      timestamp: record.startTimeInSeconds,
      heart_rate: record.averageHeartRateInBeatsPerMinute,
      source: 'epoch'
    });

    sourceIds.push(created._id);
  }

  return sourceIds;
}

async function storeSummaryRecords(records, authRecord) {
  const sourceIds = [];

  for (const record of records) {
    const saved = await GarminDailySummary.findOneAndUpdate(
      {
        user_id: authRecord.user_id,
        calendar_date: new Date(record.calendarDate)
      },
      {
        $set: {
          user_id: authRecord.user_id,
          encoded_user_id: record.userId || authRecord.encoded_user_id || authRecord.connected_garmin_user_id,
          calendar_date: new Date(record.calendarDate),
          steps: record.totalSteps,
          distance_meters: record.totalDistanceInMeters,
          active_kcal: record.activeKilocalories,
          bmr_kcal: record.bmrKilocalories,
          avg_heart_rate: record.averageHeartRateInBeatsPerMinute,
          resting_heart_rate: record.restingHeartRateInBeatsPerMinute,
          highest_heart_rate: record.maxHeartRateInBeatsPerMinute,
          stress_avg: record.averageStressLevel,
          summary_id: record.summaryId
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    sourceIds.push(saved._id);
  }

  return sourceIds;
}

async function processNotification(notification, pingType) {
  const authRecord = await findAuthRecord({
    encodedUserId: notification?.userId,
    userAccessToken: notification?.userAccessToken
  });

  if (!authRecord) {
    logger.warn(`Garmin ping skipped: no connected auth found for ${pingType} userId=${notification?.userId || 'unknown'}`);
    return;
  }

  const callbackData = await fetchCallbackDataWithRetry(notification, authRecord);

  if (pingType === 'heart-rate') {
    const records = extractRecords(callbackData, 'epochs');
    const sourceIds = await storeHeartRateRecords(records, authRecord);
    await enqueueAlertJob({
      userId: authRecord.user_id,
      metricType: 'heart_rate',
      source: 'garmin_ping',
      sourceIds
    });
    logger.info(`Garmin ping processed: heart-rate | user=${authRecord.user_id} | count=${records.length}`);
    return;
  }

  if (pingType === 'summary') {
    const records = extractRecords(callbackData, 'dailies');
    await storeSummaryRecords(records, authRecord);
    logger.info(`Garmin ping processed: summary | user=${authRecord.user_id} | count=${records.length}`);
    return;
  }

  if (pingType === 'bp') {
    logger.info(`Garmin ping ignored: bp | user=${authRecord.user_id}`);
  }
}

async function processPingNotifications(req, pingType, notifications) {
  try {
    for (const notification of notifications) {
      await processNotification(notification, pingType);
    }
  } catch (error) {
    logger.error(`Garmin ping processing error: ${pingType}`, error);
    await sendPingErrorAlert(req, pingType, notifications, error);
  }
}

function createPingHandler(pingType) {
  return async function handlePing(req, res) {
    const notifications = normalizeNotifications(req.body);

    logger.info(`Garmin ping accepted: ${pingType} | count=${notifications.length}`);
    void sendPingReceivedAlert(req, pingType, notifications);
    void processPingNotifications(req, pingType, notifications);

    return res.status(200).send('OK');
  };
}

module.exports = {
  pingHeartRateEpoch: createPingHandler('heart-rate'),
  pingDailySummary: createPingHandler('summary'),
  pingBloodPressure: createPingHandler('bp')
};
