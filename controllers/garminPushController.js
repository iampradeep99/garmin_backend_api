// controllers/garminPushController.js

const { sendResponse } = require('../middlewares/common');
const logger = require('../utils/logger');
const GarminAuth = require('../models/garminAuthModel');
const GarminBloodPressure = require('../models/garminBloodPressure');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminDailySummary = require('../models/garmindailySummary');

// ─── Helper: resolve internal user_id from Garmin's encoded user id ───────────────────────────────────────────────────────────────
async function getUserIdFromEncodedId(encodedUserId) {

  if (!encodedUserId) return null;

  // Try to find existing user with this encoded id
  // const existing = await GarminAuth.findOne({
  //   encoded_user_id: encodedUserId,
  //   is_connected: true
  // }).lean();

  // AFTER — checks both fields
  const existing = await GarminAuth.findOne({
    $or: [
      { encoded_user_id: encodedUserId },
      { connected_garmin_user_id: encodedUserId }
    ],
    is_connected: true
  }).lean();

  if (existing) return existing.user_id;

  // Fallback: assign encoded id to the most recently connected user
  const auth = await GarminAuth.findOne({ is_connected: true })
    .sort({ updated_timestamp: -1 });

  if (!auth) return null;

  auth.encoded_user_id = encodedUserId;
  await auth.save();

  return auth.user_id;
}

// ─── Push: Heart Rate Epochs ──────────────────────────────────────────────────
async function pushHeartRateEpoch(req, res) {
  // Garmin sends encoded user id in each push. We need to map it to our internal user_id.
  console.log("INCOMING userId values:", (req.body.epochs || []).map(x => x.userId));
  try {
    console.log("GARMIN PUSH - Heart Rate:", JSON.stringify(req.body, null, 2));

    const epochs = req.body.epochs || [];

    for (const e of epochs) {
      const userId = await getUserIdFromEncodedId(e.userId);
      if (!userId) continue;

      await GarminHeartRate.create({
        user_id: userId,
        encoded_user_id: e.userId,
        timestamp: e.startTimeInSeconds,
        heart_rate: e.averageHeartRateInBeatsPerMinute,
        source: 'epoch'
      });
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Heart Rate Push Error", err);
    return res.status(200).send("OK"); // always 200 so Garmin does not retry
  }
}

// ─── Push: Daily Summaries ────────────────────────────────────────────────────
async function pushDailySummary(req, res) {
  // Garmin sends encoded user id in each push. We need to map it to our internal user_id.
  console.log("INCOMING userId values:", ( req.body.dailies || []).map(x => x.userId));
  try {
    console.log("GARMIN PUSH - Daily Summary:", JSON.stringify(req.body, null, 2));

    const summaries = req.body.dailies || [];

    for (const s of summaries) {
      const userId = await getUserIdFromEncodedId(s.userId);
      if (!userId) continue;

      await GarminDailySummary.findOneAndUpdate(
        {
          user_id: userId,
          calendar_date: new Date(s.calendarDate)
        },

        {
          $set: {
            user_id: userId,
            encoded_user_id: s.userId,
            calendar_date: new Date(s.calendarDate),
            steps: s.totalSteps,
            distance_meters: s.totalDistanceInMeters,
            active_kcal: s.activeKilocalories,
            bmr_kcal: s.bmrKilocalories,
            avg_heart_rate: s.averageHeartRateInBeatsPerMinute,
            resting_heart_rate: s.restingHeartRateInBeatsPerMinute,
            highest_heart_rate: s.maxHeartRateInBeatsPerMinute,
            stress_avg: s.averageStressLevel,
            summary_id: s.summaryId
          }
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Daily Summary Push Error", err);
    return res.status(200).send("OK");
  }
}

// ─── Push: Blood Pressure ─────────────────────────────────────────────────────
async function pushBloodPressure(req, res) {
  // Garmin sends encoded user id in each push. We need to map it to our internal user_id.
  console.log("INCOMING userId values:", (req.body.bloodPressureSummaries || []).map(x => x.userId));
  try {
    console.log("GARMIN PUSH - Blood Pressure:", JSON.stringify(req.body, null, 2));

    const readings = req.body.bloodPressureSummaries || [];

    for (const bp of readings) {
      const userId = await getUserIdFromEncodedId(bp.userId);
      if (!userId) continue;

      await GarminBloodPressure.findOneAndUpdate(
        { summary_id: bp.summaryId },
        {
          $set: {
            user_id: userId,
            encoded_user_id: bp.userId,
            measurement_time: bp.startTimeInSeconds,
            systolic: bp.systolicValue,
            diastolic: bp.diastolicValue,
            pulse: bp.pulseValue,
            summary_id: bp.summaryId
          }
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Blood Pressure Push Error", err);
    return res.status(200).send("OK");
  }
}

module.exports = {
  pushHeartRateEpoch,
  pushDailySummary,
  pushBloodPressure
};