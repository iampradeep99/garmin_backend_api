const logger = require('../utils/logger');
const GarminAuth = require('../models/garminAuthModel');
const GarminBloodPressure = require('../models/garminBloodPressure');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminDailySummary = require('../models/garmindailySummary');
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

function getRequestMeta(req, pushType, records) {
  const userIds = records
    .map((record) => record?.userId)
    .filter(Boolean)
    .slice(0, 5);

  return {
    pushType,
    count: records.length,
    userIds,
    endpoint: req.originalUrl,
    method: req.method,
    ip: req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown',
    receivedAt: formatDateTime()
  };
}

function buildHtmlFromMeta(title, meta, extraLine = '') {
  const userIdText = meta.userIds.length ? meta.userIds.join(', ') : 'No userId found';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
      <h2 style="margin-bottom: 12px;">${title}</h2>
      <p><strong>Push Type:</strong> ${meta.pushType}</p>
      <p><strong>Records:</strong> ${meta.count}</p>
      <p><strong>Endpoint:</strong> ${meta.endpoint}</p>
      <p><strong>Method:</strong> ${meta.method}</p>
      <p><strong>IP:</strong> ${meta.ip}</p>
      <p><strong>Received At:</strong> ${meta.receivedAt}</p>
      <p><strong>User IDs:</strong> ${userIdText}</p>
      ${extraLine ? `<p><strong>Details:</strong> ${extraLine}</p>` : ''}
    </div>
  `;
}

async function sendPushReceivedAlert(req, pushType, records) {
  const meta = getRequestMeta(req, pushType, records);
  const subject = `Garmin Push Received - ${pushType}`;
  const userIdText = meta.userIds.length ? meta.userIds.join(', ') : 'No userId found';
  const text = [
    'Garmin push request received successfully.',
    `Push Type: ${meta.pushType}`,
    `Records: ${meta.count}`,
    `Endpoint: ${meta.endpoint}`,
    `Method: ${meta.method}`,
    `IP: ${meta.ip}`,
    `Received At: ${meta.receivedAt}`,
    `User IDs: ${userIdText}`
  ].join('\n');

  const result = await sendGarminAlertEmail({
    subject,
    text,
    html: buildHtmlFromMeta('Garmin push request received successfully.', meta)
  });

  if (!result.success) {
    logger.warn(`Garmin push received email failed: ${result.error}`);
  }
}

async function sendPushErrorAlert(req, pushType, records, error) {
  const meta = getRequestMeta(req, pushType, records);
  const errorMessage = error?.stack || error?.message || String(error);
  const subject = `Garmin Push Error - ${pushType}`;
  const userIdText = meta.userIds.length ? meta.userIds.join(', ') : 'No userId found';
  const text = [
    'Garmin push request failed while processing.',
    `Push Type: ${meta.pushType}`,
    `Records: ${meta.count}`,
    `Endpoint: ${meta.endpoint}`,
    `Method: ${meta.method}`,
    `IP: ${meta.ip}`,
    `Received At: ${meta.receivedAt}`,
    `User IDs: ${userIdText}`,
    `Error: ${errorMessage}`
  ].join('\n');

  const result = await sendGarminAlertEmail({
    subject,
    text,
    html: buildHtmlFromMeta('Garmin push request failed while processing.', meta, errorMessage)
  });

  if (!result.success) {
    logger.warn(`Garmin push error email failed: ${result.error}`);
  }
}

async function getUserIdFromEncodedId(encodedUserId) {
  if (!encodedUserId) return null;

  const existing = await GarminAuth.findOne({
    $or: [
      { encoded_user_id: encodedUserId },
      { connected_garmin_user_id: encodedUserId }
    ],
    is_connected: true
  }).lean();

  if (existing) return existing.user_id;

  const auth = await GarminAuth.findOne({ is_connected: true }).sort({ updated_timestamp: -1 });

  if (!auth) return null;

  auth.encoded_user_id = encodedUserId;
  await auth.save();

  return auth.user_id;
}

async function pushHeartRateEpoch(req, res) {
  const epochs = req.body.epochs || [];
  const queuedUsers = new Map();

  console.log("INCOMING userId values:", epochs.map((item) => item.userId));

  try {
    console.log("GARMIN PUSH - Heart Rate:", JSON.stringify(req.body, null, 2));

    for (const epoch of epochs) {
      const userId = await getUserIdFromEncodedId(epoch.userId);
      if (!userId) continue;

      const created = await GarminHeartRate.create({
        user_id: userId,
        encoded_user_id: epoch.userId,
        timestamp: epoch.startTimeInSeconds,
        heart_rate: epoch.averageHeartRateInBeatsPerMinute,
        source: 'epoch'
      });

      if (!queuedUsers.has(userId)) {
        queuedUsers.set(userId, []);
      }

      queuedUsers.get(userId).push(created._id);
    }

    for (const [userId, sourceIds] of queuedUsers.entries()) {
      await enqueueAlertJob({
        userId,
        metricType: 'heart_rate',
        source: 'garmin_push',
        sourceIds
      });
    }

    logger.info(`Garmin push processed: heart-rate | count=${epochs.length}`);
    void sendPushReceivedAlert(req, 'heart-rate', epochs);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Heart Rate Push Error", err);
    void sendPushErrorAlert(req, 'heart-rate', epochs, err);
    return res.status(200).send("OK");
  }
}

async function pushDailySummary(req, res) {
  const summaries = req.body.dailies || [];

  console.log("INCOMING userId values:", summaries.map((item) => item.userId));

  try {
    console.log("GARMIN PUSH - Daily Summary:", JSON.stringify(req.body, null, 2));

    for (const summary of summaries) {
      const userId = await getUserIdFromEncodedId(summary.userId);
      if (!userId) continue;

      await GarminDailySummary.findOneAndUpdate(
        {
          user_id: userId,
          calendar_date: new Date(summary.calendarDate)
        },
        {
          $set: {
            user_id: userId,
            encoded_user_id: summary.userId,
            calendar_date: new Date(summary.calendarDate),
            steps: summary.totalSteps,
            distance_meters: summary.totalDistanceInMeters,
            active_kcal: summary.activeKilocalories,
            bmr_kcal: summary.bmrKilocalories,
            avg_heart_rate: summary.averageHeartRateInBeatsPerMinute,
            resting_heart_rate: summary.restingHeartRateInBeatsPerMinute,
            highest_heart_rate: summary.maxHeartRateInBeatsPerMinute,
            stress_avg: summary.averageStressLevel,
            summary_id: summary.summaryId
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    logger.info(`Garmin push processed: summary | count=${summaries.length}`);
    void sendPushReceivedAlert(req, 'summary', summaries);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Daily Summary Push Error", err);
    void sendPushErrorAlert(req, 'summary', summaries, err);
    return res.status(200).send("OK");
  }
}

async function pushBloodPressure(req, res) {
  const readings = req.body.bloodPressureSummaries || [];
  const queuedUsers = new Map();

  console.log("INCOMING userId values:", readings.map((item) => item.userId));

  try {
    console.log("GARMIN PUSH - Blood Pressure:", JSON.stringify(req.body, null, 2));

    for (const reading of readings) {
      const userId = await getUserIdFromEncodedId(reading.userId);
      if (!userId) continue;

      const saved = await GarminBloodPressure.findOneAndUpdate(
        { summary_id: reading.summaryId },
        {
          $set: {
            user_id: userId,
            encoded_user_id: reading.userId,
            measurement_time: reading.startTimeInSeconds,
            systolic: reading.systolicValue,
            diastolic: reading.diastolicValue,
            pulse: reading.pulseValue,
            summary_id: reading.summaryId
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      if (!queuedUsers.has(userId)) {
        queuedUsers.set(userId, []);
      }

      queuedUsers.get(userId).push(saved._id);
    }

    for (const [userId, sourceIds] of queuedUsers.entries()) {
      await enqueueAlertJob({
        userId,
        metricType: 'blood_pressure',
        source: 'garmin_push',
        sourceIds
      });
    }

    logger.info(`Garmin push processed: bp | count=${readings.length}`);
    void sendPushReceivedAlert(req, 'bp', readings);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Blood Pressure Push Error", err);
    void sendPushErrorAlert(req, 'bp', readings, err);
    return res.status(200).send("OK");
  }
}

module.exports = {
  pushHeartRateEpoch,
  pushDailySummary,
  pushBloodPressure
};
