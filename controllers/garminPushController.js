

const logger = require('../utils/logger');
const GarminAuth = require('../models/garminAuthModel');
const GarminSpo2Schema = require('../models/garminBloodPressure');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminDailySummary = require('../models/garmindailySummary');
const { sendGarminAlertEmail } = require('../common/garminAlertMail');
const { enqueueAlertJob } = require('../services/alertJobService');
const GarminUserMetrics = require('../models/garminuserMetrics')

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

// ✅ UPDATED (payload added)
function buildHtmlFromMeta(title, meta, extraLine = '', payload = null) {
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

      ${
        payload
          ? `<h3>Raw Payload</h3>
             <pre style="background:#f4f4f4;padding:10px;border-radius:5px;max-height:400px;overflow:auto;">
${JSON.stringify(payload, null, 2)}
             </pre>`
          : ''
      }
    </div>
  `;
}

// ✅ UPDATED (payload pass)
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
    html: buildHtmlFromMeta(
      'Garmin push request received successfully.',
      meta,
      '',
      req.body // ✅ payload added
    )
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
    html: buildHtmlFromMeta(
      'Garmin push request failed while processing.',
      meta,
      errorMessage,
      req.body // ✅ payload added here also
    )
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



function parseEpochSummaries(epochString, baseTimestamp) {
  if (!epochString) return [];

  return epochString.split(',').map(item => {
    const [sec, value] = item.split(':').map(s => s.trim());

    const second = Number(sec);
    const heartRate = Number(value);

    return {
      second,
      minute: Number((second / 60).toFixed(4)),
      heart_rate: heartRate,
      timestamp: baseTimestamp + second
    };
  });
}

async function pushHeartRateEpoch(req, res) {
  const records = req.body || [];
  const queuedUsers = new Map();

  try {
    console.log("GARMIN PUSH - Heart Rate:", JSON.stringify(req.body, null, 2));

    const bulkData = [];

    for (const record of records) {
      try {
        const userId = await getUserIdFromEncodedId(record.userId);
        if (!userId) {
          console.warn("User not found for encoded_user_id:", record.userId);
          continue;
        }

        if (!record.summaries || !Array.isArray(record.summaries)) continue;

        for (const summary of record.summaries) {
          if (summary.summaryType !== 'heart_rate') continue;

          const heartRate = summary.avgValue;

          bulkData.push({
            user_id: userId,
            encoded_user_id: record.userId,
            timestamp: record.startTimeInSeconds,
            heart_rate: heartRate ?? null,

            summary_id: record.summaryId,
            calendar_date: record.calendarDate,
            duration_in_seconds: record.durationInSeconds,

            start_time_offset_in_seconds: record.startTimeOffsetInSeconds,
            start_time_offset_in_minutes: record.startTimeOffsetInSeconds / 60,

            min_heart_rate: summary.minValue,
            max_heart_rate: summary.maxValue,

            // ✅ KEEP ORIGINAL STRING
            epoch_summaries: summary.epochSummaries,

            // ✅ ADD PARSED ARRAY
            epoch_summary_array: parseEpochSummaries(
              summary.epochSummaries,
              record.startTimeInSeconds
            ),

            raw_payload: record,
            source: 'epoch'
          });
        }

      } catch (innerErr) {
        console.error("Error processing epoch:", innerErr.message);
      }
    }

    let createdDocs = [];
    if (bulkData.length > 0) {
      createdDocs = await GarminHeartRate.insertMany(bulkData, {
        ordered: false
      });
    }

    for (const doc of createdDocs) {
      if (!doc.heart_rate) continue;

      if (!queuedUsers.has(doc.user_id)) {
        queuedUsers.set(doc.user_id, []);
      }

      queuedUsers.get(doc.user_id).push(doc._id);
    }

    for (const [userId, sourceIds] of queuedUsers.entries()) {
      try {
        await enqueueAlertJob({
          userId,
          metricType: 'heart_rate',
          source: 'garmin_push',
          sourceIds
        });
      } catch (queueErr) {
        console.error("Queue error:", queueErr.message);
      }
    }

    logger.info(
      `Garmin push processed: heart-rate | received=${records.length} | saved=${createdDocs.length}`
    );

    void sendPushReceivedAlert(req, 'heart-rate', records);

    return res.status(200).send("OK");

  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("Heart Rate Push Error", err);

    void sendPushErrorAlert(req, 'heart-rate', records, err);

    return res.status(200).send("OK");
  }
}




function parseHeartRateSamples(input) {
  try {
    if (!input) return [];

    let obj;

    // case 1: already object (Garmin actual payload)
    if (typeof input === 'object') {
      obj = input;
    }

    // case 2: string (old/broken format)
    else if (typeof input === 'string') {
      const fixed = input.replace(/(\d+):/g, '"$1":');
      obj = JSON.parse(fixed);
    } else {
      return [];
    }

    return Object.entries(obj).map(([key, value]) => ({
      offset: Number(key),
      value: Number(value)
    }));
  } catch (err) {
    console.error("Heart rate parse error:", err);
    return [];
  }
}

async function pushDailySummary(req, res) {
  const summaries = req.body.dailies || [];

  console.log("INCOMING userId values:", summaries.map(i => i.userId));

  try {
    console.log("GARMIN PUSH:", JSON.stringify(req.body, null, 2));

    for (const summary of summaries) {
      const userId = await getUserIdFromEncodedId(summary.userId);
      if (!userId) continue;

      const parsedSamples = parseHeartRateSamples(summary.timeOffsetHeartRateSamples);

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

            activity_type: summary.activityType,

            active_kcal: summary.activeKilocalories,
            bmr_kcal: summary.bmrKilocalories,

            steps: summary.steps,
            pushes: summary.pushes,
            distance_meters: summary.distanceInMeters,
            push_distance_meters: summary.pushDistanceInMeters,

            duration_seconds: summary.durationInSeconds,
            active_time_seconds: summary.activeTimeInSeconds,
            start_time_seconds: summary.startTimeInSeconds,
            start_time_offset_seconds: summary.startTimeOffsetInSeconds,

            moderate_intensity_seconds: summary.moderateIntensityDurationInSeconds,
            vigorous_intensity_seconds: summary.vigorousIntensityDurationInSeconds,

            floors_climbed: summary.floorsClimbed,

            min_heart_rate: summary.minHeartRateInBeatsPerMinute,
            max_heart_rate: summary.maxHeartRateInBeatsPerMinute,
            avg_heart_rate: summary.averageHeartRateInBeatsPerMinute,
            resting_heart_rate: summary.restingHeartRateInBeatsPerMinute,

            // ✅ FIX: always store string safely
            heart_rate_samples: summary.timeOffsetHeartRateSamples
              ? JSON.stringify(summary.timeOffsetHeartRateSamples)
              : null,

            // ✅ parsed array for querying
            heart_rate_samples_array: parsedSamples,

            steps_goal: summary.stepsGoal,
            pushes_goal: summary.pushesGoal,
            intensity_goal_seconds: summary.intensityDurationGoalInSeconds,
            floors_goal: summary.floorsClimbedGoal,

            stress_avg: summary.averageStressLevel,
            stress_max: summary.maxStressLevel,
            stress_duration_seconds: summary.stressDurationInSeconds,
            rest_stress_duration_seconds: summary.restStressDurationInSeconds,
            activity_stress_duration_seconds: summary.activityStressDurationInSeconds,
            low_stress_duration_seconds: summary.lowStressDurationInSeconds,
            medium_stress_duration_seconds: summary.mediumStressDurationInSeconds,
            high_stress_duration_seconds: summary.highStressDurationInSeconds,
            stress_qualifier: summary.stressQualifier,

            body_battery_charged: summary.bodyBatteryChargedValue,
            body_battery_drained: summary.bodyBatteryDrainedValue,

            source: summary.source,

            summary_id: summary.summaryId
          }
        },
        {
          upsert: true,
          new: true
        }
      );
    }

    logger.info(`Garmin push processed: summary | count=${summaries.length}`);
    void sendPushReceivedAlert(req, 'summary', summaries);

    return res.status(200).send("OK");

  } catch (err) {
    console.error("PUSH ERROR:", err);
    logger.error("Daily Summary Push Error", err);
    void sendPushErrorAlert(req, 'summary', summaries, err);

    return res.status(200).send("OK");
  }
}



async function pulseOx(req, res) {
  const readings = req.body || [];
  const queuedUsers = new Map();

  console.log("INCOMING userId values:", readings.map((item) => item.userId));

  try {
    console.log("GARMIN PUSH - SPO2:", JSON.stringify(req.body, null, 2));

    for (const reading of readings) {
      const userId = await getUserIdFromEncodedId(reading.userId);
      if (!userId) continue;

      // ✅ PARSE FUNCTION INLINE
      let spo2Array = [];
      try {
        if (reading.timeOffsetSpo2Values) {
          const cleaned = reading.timeOffsetSpo2Values
            .replace(/^{|}$/g, '')
            .replace(/\.\.\./g, '');

          spo2Array = cleaned
            .split(',')
            .map(pair => {
              const [k, v] = pair.split(':');

              const offset = parseInt(k?.trim(), 10);
              const value = parseInt(v?.trim(), 10);

              if (isNaN(offset) || isNaN(value)) return null;

              return { offset, value };
            })
            .filter(Boolean);
        }
      } catch (e) {
        console.error("SPO2 PARSE ERROR:", e);
      }

      const saved = await GarminSpo2Schema.findOneAndUpdate(
        { summary_id: reading.summaryId },
        {
          $set: {
            user_id: userId,
            encoded_user_id: reading.userId,
            summary_id: reading.summaryId,

            calendar_date: reading.calendarDate,
            start_time: reading.startTimeInSeconds,
            duration: reading.durationInSeconds,
            offset: reading.startTimeOffsetInSeconds,
            on_demand: reading.onDemand,

            // ✅ STORE BOTH
            spo2_string: reading.timeOffsetSpo2Values,
            spo2_array: spo2Array
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
        metricType: 'spo2', // ✅ changed
        source: 'garmin_push',
        sourceIds
      });
    }

    logger.info(`Garmin push processed: spo2 | count=${readings.length}`);
    void sendPushReceivedAlert(req, 'spo2', readings);

    return res.status(200).send("OK");

  } catch (err) {
    console.error("PUSH ERROR DETAILS:", err.message, err);
    logger.error("SPO2 Push Error", err);
    void sendPushErrorAlert(req, 'spo2', readings, err);

    return res.status(200).send("OK");
  }
}


async function userMetrics(req, res) {
  const metrics = req.body || [];

  console.log("INCOMING userMetrics:", JSON.stringify(metrics, null, 2));

  try {
    for (const item of metrics) {
      const {
        userId,
        summaryId,
        calendarDate,
        vo2Max,
        vo2MaxCycling,
        fitnessAge,
        enhanced
      } = item;

      const user_id = await getUserIdFromEncodedId(userId);

      if (!user_id) {
        console.log(`User not found for encoded_user_id: ${userId}`);
        continue;
      }

      await GarminUserMetrics.updateOne(
        { summary_id: summaryId }, // unique check
        {
          $set: {
            user_id,
            encoded_user_id: userId,
            summary_id: summaryId,
            calendar_date: new Date(calendarDate),
            vo2_max: vo2Max,
            vo2_max_cycling: vo2MaxCycling,
            fitness_age: fitnessAge,
            enhanced: enhanced
          }
        },
        { upsert: true }
      );
    }

   return res.status(200).send("OK");

  } catch (error) {
    console.error("Error storing user metrics:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
}


module.exports = {
  pushHeartRateEpoch,
  pushDailySummary,
  pulseOx,
  userMetrics
};