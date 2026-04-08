const logger = require('../utils/logger');
const GarminAuth = require('../models/garminAuthModel');
const GarminSpo2Schema = require('../models/garminBloodPressure');
const GarminHeartRate = require('../models/garminHeartRates');
const GarminDailySummary = require('../models/garmindailySummary');
const { sendGarminAlertEmail } = require('../common/garminAlertMail');
const { enqueueAlertJob } = require('../services/alertJobService');
const GarminUserMetrics = require('../models/garminuserMetrics');
const GarminHeartRateSchema = require('../models/garminHeartRates');

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
    html: buildHtmlFromMeta('Garmin push request received successfully.', meta, '', req.body)
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
    html: buildHtmlFromMeta('Garmin push request failed while processing.', meta, errorMessage, req.body)
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

          const timestamp = record.startTimeInSeconds;
          const heartRate = summary.avgValue ?? null;

          if (!heartRate) continue;

          const existing = await GarminHeartRate.findOne({
            user_id: userId,
            timestamp,
            heart_rate: heartRate
          }).lean();

          if (existing) {
            console.log(`Duplicate skipped for user=${userId} timestamp=${timestamp}`);
            continue;
          }

          const doc = await GarminHeartRate.create({
            user_id: userId,
            encoded_user_id: record.userId,
            timestamp,
            heart_rate: heartRate,
            timestamp_time: formatDateTime(new Date(timestamp * 1000)),
            date: record.calendarDate,
            insertedAt: new Date()
          });

          if (!queuedUsers.has(userId)) {
            queuedUsers.set(userId, []);
          }
          queuedUsers.get(userId).push(doc._id);
        }

      } catch (innerErr) {
        console.error("Error processing epoch:", innerErr.message);
      }
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

    logger.info(`Garmin push processed: heart-rate | received=${records.length}`);
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

    if (typeof input === 'object') {
      obj = input;
    } else if (typeof input === 'string') {
      let parsed = input.trim();
      
      if (parsed.startsWith('{') && parsed.endsWith('}')) {
        parsed = parsed.slice(1, -1); 
      }
      
      const fixed = '{' + parsed.replace(/(\d+):\s*/g, '"$1": ') + '}';
      obj = JSON.parse(fixed);
    } else {
      return [];
    }

    return Object.entries(obj)
      .map(([key, value]) => ({
        offset: Number(key),
        value: Number(value)
      }))
      .filter((item) => Number.isFinite(item.offset) && Number.isFinite(item.value))
      .sort((a, b) => a.offset - b.offset);
  } catch (err) {
    console.error("Heart rate parse error:", err);
    return [];
  }
}

async function saveHeartRateSamples({ userId, encodedUserId, calendarDate, samples }) {
  if (!samples || samples.length === 0) return [];

  const sourceIds = [];

  try {
    const baseDate = new Date(calendarDate).setHours(0, 0, 0, 0);

    for (const s of samples) {
      const timestamp = Math.floor((baseDate + (s.offset * 1000)) / 1000);

      const existing = await GarminHeartRate.findOne({
        user_id: userId,
        timestamp,
        heart_rate: s.value
      }).lean();

      if (existing) {
        console.log(`Duplicate skipped for user=${userId} timestamp=${timestamp}`);
        sourceIds.push(existing._id);
        continue;
      }

      const created = await GarminHeartRate.create({
        user_id: userId,
        encoded_user_id: encodedUserId,
        timestamp,
        heart_rate: s.value,
        timestamp_time: formatDateTime(new Date(timestamp * 1000)),
        date: calendarDate,
        insertedAt: new Date()
      });

      sourceIds.push(created._id);
    }

  } catch (err) {
    console.error("Insert error:", err);
  }

  return sourceIds;
}

function getLatestSample(samples) {
  if (!Array.isArray(samples) || !samples.length) {
    return null;
  }

  return samples[samples.length - 1];
}

async function pushDailySummary(req, res) {
  // Garmin sends array directly, not wrapped in 'dailies'
  const summaries = Array.isArray(req.body) ? req.body : (req.body.dailies || []);
  const latestReadingIdsByUser = new Map();

  console.log("INCOMING userId values:", summaries.map(i => i.userId));

  try {
    console.log("GARMIN PUSH:", JSON.stringify(req.body, null, 2));

    for (const summary of summaries) {
      const userId = await getUserIdFromEncodedId(summary.userId);
      if (!userId) continue;

      const parsedSamples = parseHeartRateSamples(summary.timeOffsetHeartRateSamples);

      const sourceIds = await saveHeartRateSamples({
        userId,
        encodedUserId: summary.userId,
        calendarDate: summary.calendarDate,
        samples: parsedSamples
      });

      const latestSample = getLatestSample(parsedSamples);

      if (latestSample && sourceIds.length) {
        const latestIndex = parsedSamples.findIndex(
          (sample) => sample.offset === latestSample.offset && sample.value === latestSample.value
        );

        const latestSourceId = latestIndex >= 0 ? sourceIds[latestIndex] : sourceIds[sourceIds.length - 1];

        if (latestSourceId) {
          latestReadingIdsByUser.set(userId, String(latestSourceId));
        }
      }

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

            activity_type: summary.activityType ?? null,

            active_kcal: summary.activeKilocalories ?? null,
            bmr_kcal: summary.bmrKilocalories ?? null,

            steps: summary.steps ?? null,
            pushes: summary.pushes ?? null,
            distance_meters: summary.distanceInMeters ?? null,
            push_distance_meters: summary.pushDistanceInMeters ?? null,

            duration_seconds: summary.durationInSeconds ?? null,
            active_time_seconds: summary.activeTimeInSeconds ?? null,
            start_time_seconds: summary.startTimeInSeconds ?? null,
            start_time_offset_seconds: summary.startTimeOffsetInSeconds ?? null,

            moderate_intensity_seconds: summary.moderateIntensityDurationInSeconds ?? null,
            vigorous_intensity_seconds: summary.vigorousIntensityDurationInSeconds ?? null,

            floors_climbed: summary.floorsClimbed ?? null,

            min_heart_rate: summary.minHeartRateInBeatsPerMinute ?? null,
            max_heart_rate: summary.maxHeartRateInBeatsPerMinute ?? null,
            avg_heart_rate: summary.averageHeartRateInBeatsPerMinute ?? null,
            resting_heart_rate: summary.restingHeartRateInBeatsPerMinute ?? null,

            heart_rate_samples: summary.timeOffsetHeartRateSamples
              ? JSON.stringify(summary.timeOffsetHeartRateSamples)
              : null,

            heart_rate_samples_array: parsedSamples,

            steps_goal: summary.stepsGoal ?? null,
            pushes_goal: summary.pushesGoal ?? null,
            intensity_goal_seconds: summary.intensityDurationGoalInSeconds ?? null,
            floors_goal: summary.floorsClimbedGoal ?? null,

            stress_avg: summary.averageStressLevel ?? null,
            stress_max: summary.maxStressLevel ?? null,
            stress_duration_seconds: summary.stressDurationInSeconds ?? null,
            rest_stress_duration_seconds: summary.restStressDurationInSeconds ?? null,
            activity_stress_duration_seconds: summary.activityStressDurationInSeconds ?? null,
            low_stress_duration_seconds: summary.lowStressDurationInSeconds ?? null,
            medium_stress_duration_seconds: summary.mediumStressDurationInSeconds ?? null,
            high_stress_duration_seconds: summary.highStressDurationInSeconds ?? null,
            stress_qualifier: summary.stressQualifier ?? null,

            body_battery_charged: summary.bodyBatteryChargedValue ?? null,
            body_battery_drained: summary.bodyBatteryDrainedValue ?? null,

            source: summary.source ?? null,
            summary_id: summary.summaryId ?? null,

            updatedAt: new Date()
          }
        },
        {
          upsert: true,
          new: true,
          strict: false
        }
      );
    }

    for (const [userId, latestSourceId] of latestReadingIdsByUser.entries()) {
      await enqueueAlertJob({
        userId,
        metricType: 'heart_rate',
        source: 'garmin_daily_summary',
        sourceIds: [latestSourceId]
      });
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

async function summaryDetails(req, res) {
  try {
    const payload = req.body;

    const text = JSON.stringify(payload, null, 2);

    const html = `
      <h3>Garmin Test Data</h3>
      <pre>${text}</pre>
    `;

    await sendGarminAlertEmail({
      to: "pradeep.meandev@gmail.com",
      subject: "Garmin Test Data",
      text,
      html
    });

  return res.status(200).send("OK");

  } catch (err) {
    console.log(err);
    res.status(500).send({ success: false, message: "Error sending email" });
  }
}

module.exports = {
  pushHeartRateEpoch,
  pushDailySummary,
  summaryDetails
};
