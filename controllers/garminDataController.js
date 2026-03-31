const { sendResponse } = require('../middlewares/common');
const logger = require('../utils/logger');
const GarminDailySummary = require('../models/garmindailySummary');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminBloodPressure = require('../models/garminBloodPressure');
const { sendSMS } = require('../common/sms.js');
const { sendEmail } = require('../common/mail.js');

async function calculateAvgHeartRateForDate(userId, date) {
  const d = new Date(date);
  const dayStart = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    23, 59, 59, 999
  ));

  const startTs = Math.floor(dayStart.getTime() / 1000);
  const endTs = Math.floor(dayEnd.getTime() / 1000);

  const entries = await GarminHeartRate.find({
    user_id: userId,
    timestamp: { $gte: startTs, $lte: endTs }
  }).lean();

  if (!entries.length) return null;

  const total = entries.reduce((sum, entry) => sum + (entry.heart_rate || 0), 0);
  return Math.round(total / entries.length);
}

async function getLatestBloodPressure(userId) {
  const bp = await GarminBloodPressure.findOne({ user_id: userId })
    .sort({ measurement_time: -1 })
    .lean();

  if (!bp) return null;

  return {
    systolic: bp.systolic,
    diastolic: bp.diastolic,
    pulse: bp.pulse,
    measurement_time: bp.measurement_time
  };
}

async function getSummary(req, res) {
  try {
    const userId = req.user.user_id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const summaries = await GarminDailySummary.find({
      user_id: userId,
      calendar_date: { $gte: todayStart, $lte: todayEnd }
    })
      .sort({ calendar_date: -1 })
      .lean();

    const transformedSummaries = summaries.map((summary) => ({
      _id: summary._id,
      user_id: summary.user_id,
      encoded_user_id: summary.encoded_user_id,
      calendar_date: summary.calendar_date,
      steps: summary.steps,
      distance_meters: summary.distance_meters,
      active_kcal: summary.active_kcal,
      bmr_kcal: summary.bmr_kcal,
      avg_heart_rate: summary.avg_heart_rate,
      resting_heart_rate: summary.resting_heart_rate,
      stress_avg: summary.stress_avg
    }));

    return sendResponse(res, '200', 'Daily summaries retrieved', transformedSummaries);
  } catch (err) {
    logger.error('Error in getSummary:', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}

async function getHeartRate(req, res) {
  try {
    const userId = req.user.user_id;
    const { startTime, endTime, limit } = req.query;
    const filter = { user_id: userId };

    if (startTime || endTime) {
      filter.timestamp = {};

      if (startTime) {
        const start = parseInt(startTime, 10);
        if (isNaN(start)) {
          return sendResponse(res, '400', 'Invalid startTime (must be Unix seconds)', []);
        }
        filter.timestamp.$gte = start;
      }

      if (endTime) {
        const end = parseInt(endTime, 10);
        if (isNaN(end)) {
          return sendResponse(res, '400', 'Invalid endTime (must be Unix seconds)', []);
        }
        filter.timestamp.$lte = end;
      }
    }

    const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);

    const heartRates = await GarminHeartRate.find(filter)
      .sort({ timestamp: -1 })
      .limit(limitNum)
      .lean();

    return sendResponse(res, '200', 'Heart rate data retrieved', heartRates);
  } catch (err) {
    logger.error('Error in getHeartRate:', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}

async function getBloodPressure(req, res) {
  try {
    const userId = req.user.user_id;
    const { startTime, endTime, limit } = req.query;
    const filter = { user_id: userId };

    if (startTime || endTime) {
      filter.measurement_time = {};

      if (startTime) {
        const start = parseInt(startTime, 10);
        if (isNaN(start)) {
          return sendResponse(res, '400', 'Invalid startTime (must be Unix seconds)', []);
        }
        filter.measurement_time.$gte = start;
      }

      if (endTime) {
        const end = parseInt(endTime, 10);
        if (isNaN(end)) {
          return sendResponse(res, '400', 'Invalid endTime (must be Unix seconds)', []);
        }
        filter.measurement_time.$lte = end;
      }
    }

    const limitNum = Math.min(parseInt(limit, 10) || 30, 100);

    const bpReadings = await GarminBloodPressure.find(filter)
      .sort({ measurement_time: -1 })
      .limit(limitNum)
      .lean();

    return sendResponse(res, '200', 'Blood pressure readings retrieved', bpReadings);
  } catch (err) {
    logger.error('Error in getBloodPressure:', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}

async function checkEmail(req, res) {
  try {
    const { phone, email, name, bpm } = req.body;

    if (!phone || !email) {
      return res.status(400).json({
        success: false,
        message: "phone and email are required"
      });
    }

    const message = `ITL Health Alert: ${name}'s heart rate has been recorded at ${bpm} bpm. Please review the individual's status at the earliest. Infodart`;
    const subject = "FitZen : Heart Rate Alert";
    const emailText = `Dear Concerned Team,

${message}

Warm Regards,
FitZen Team`;

    const [smsResponse, emailResponse] = await Promise.all([
      sendSMS({ to: phone, message }),
      sendEmail({ to: email, subject, text: emailText })
    ]);

    return res.status(200).json({
      success: true,
      sms: smsResponse,
      email: emailResponse
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

module.exports = {
  getSummary,
  getHeartRate,
  getBloodPressure,
  checkEmail,
  calculateAvgHeartRateForDate,
  getLatestBloodPressure
};
