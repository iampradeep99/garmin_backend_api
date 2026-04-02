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

    const transformedSummaries = summaries.map((s) => {
      let hrParsed = [];
      try {
        if (s.heart_rate_samples) {
          const parsed = JSON.parse(s.heart_rate_samples);
          hrParsed = Object.entries(parsed).map(([k, v]) => ({
            time_offset_sec: Number(k),
            heart_rate: Number(v)
          }));
        }
      } catch (e) {}

      return {
        id: s._id,

        date: s.calendar_date
          ? new Date(s.calendar_date).toISOString().split("T")[0]
          : null,

        activity: {
          type: s.activity_type || "UNKNOWN",
          duration_min: Math.round((s.duration_seconds || 0) / 60),
          active_time_min: Math.round((s.active_time_seconds || 0) / 60)
        },

        movement: {
          steps: s.steps || 0,
          steps_goal: s.steps_goal || 0,
          distance_km: Number(((s.distance_meters || 0) / 1000).toFixed(2)),
          floors_climbed: s.floors_climbed || 0,
          floors_goal: s.floors_goal || 0
        },

        calories: {
          active_kcal: s.active_kcal || 0,
          bmr_kcal: s.bmr_kcal || 0
        },

        heart_rate: {
          avg: s.avg_heart_rate || 0,
          resting: s.resting_heart_rate || 0,
          min: s.min_heart_rate || 0,
          max: s.max_heart_rate || 0,
          samples: hrParsed
        },

        stress: {
          avg: s.stress_avg || 0,
          max: s.stress_max || 0,
          level: s.stress_qualifier || "UNKNOWN",
          total_duration_min: Math.round((s.stress_duration_seconds || 0) / 60),
          breakdown: {
            rest: Math.round((s.rest_stress_duration_seconds || 0) / 60),
            low: Math.round((s.low_stress_duration_seconds || 0) / 60),
            medium: Math.round((s.medium_stress_duration_seconds || 0) / 60),
            high: Math.round((s.high_stress_duration_seconds || 0) / 60)
          }
        },

        intensity: {
          goal_min: Math.round((s.intensity_goal_seconds || 0) / 60),
          moderate_min: Math.round((s.moderate_intensity_seconds || 0) / 60),
          vigorous_min: Math.round((s.vigorous_intensity_seconds || 0) / 60)
        },

        body_battery: {
          charged: s.body_battery_charged || 0,
          drained: s.body_battery_drained || 0
        },

        source: s.source,
        summary_id: s.summary_id
      };
    });

    return sendResponse(
      res,
      "200",
      "Daily summary fetched successfully",
      transformedSummaries
    );
  } catch (err) {
    logger.error("Error in getSummary:", err);
    return sendResponse(res, "500", "Internal server error", []);
  }
}
// async function getHeartRate(req, res) {
//   try {
//     const userId = req.user.user_id;
//     const { startTime, endTime, limit } = req.query;
//     const filter = { user_id: userId };

//     if (startTime || endTime) {
//       filter.timestamp = {};

//       if (startTime) {
//         const start = parseInt(startTime, 10);
//         if (isNaN(start)) {
//           return sendResponse(res, '400', 'Invalid startTime (must be Unix seconds)', []);
//         }
//         filter.timestamp.$gte = start;
//       }

//       if (endTime) {
//         const end = parseInt(endTime, 10);
//         if (isNaN(end)) {
//           return sendResponse(res, '400', 'Invalid endTime (must be Unix seconds)', []);
//         }
//         filter.timestamp.$lte = end;
//       }
//     }

//     const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);

//     const heartRates = await GarminHeartRate.find(filter)
//       .sort({ timestamp: -1 })
//       .limit(limitNum)
//       .lean();

//     return sendResponse(res, '200', 'Heart rate data retrieved', heartRates);
//   } catch (err) {
//     logger.error('Error in getHeartRate:', err);
//     return sendResponse(res, '500', 'Internal server error', []);
//   }
// }

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
      .select({
        _id: 0,
        timestamp: 1,
        heart_rate: 1,
        user_id: 1
      })
      .sort({ timestamp: 1 })
      .limit(limitNum)
      .lean();

    const formatted = heartRates.map(item => {
      const dateObj = new Date(item.timestamp * 1000);

      return {
        userId: item.user_id,
        timestamp: item.timestamp,
        heartRate: item.heart_rate,

        // 🔥 Human readable
        date: dateObj.toISOString().split('T')[0], // YYYY-MM-DD
        time: dateObj.toLocaleTimeString('en-IN', { hour12: false }),
        dateTime: dateObj.toISOString() // full ISO
      };
    });

    return sendResponse(res, '200', 'Heart rate data retrieved', formatted);

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
