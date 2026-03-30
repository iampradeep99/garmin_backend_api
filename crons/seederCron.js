const cron = require('node-cron');

const GarminHeartRate = require('../models/garminHeartRates');
const GarminBloodPressure = require('../models/garminBloodPressure');
const UserThreshold = require('../models/userThreshold');

let toggle = false;

// ===== SAFE RANDOM (auto adjust) =====
const safeRand = (min, max, buffer = 5) => {
  if (max - min <= buffer * 2) {
    return Math.floor((min + max) / 2); // fallback
  }
  return Math.floor(Math.random() * (max - min - buffer * 2 + 1)) + (min + buffer);
};

// ===== ALERT RANDOM =====
const alertRandHigh = (max) => max + Math.floor(Math.random() * 40) + 5;
const alertRandLow = (min) => Math.max(1, min - Math.floor(Math.random() * 30) - 5);

// ===== MAIN =====
const insertHealthData = async () => {
  try {
    console.log("SEEDER RUN =================", new Date());

    const thresholds = await UserThreshold.find({}).lean();

    for (const t of thresholds) {
      const userId = t.user_id;
      const encodedId = `enc-${userId}`;

      let heartRate, systolic, diastolic;

      if (!toggle) {
        // ✅ SAFE (always inside updated threshold)
        heartRate = safeRand(t.min_heart_rate, t.max_heart_rate);

        systolic = safeRand(t.min_bp, t.max_bp);
        diastolic = safeRand(t.min_bp, t.max_bp - 5);

      } else {
        // 🚨 ALERT (outside updated threshold)
        const isHigh = Math.random() > 0.5;

        if (isHigh) {
          heartRate = alertRandHigh(t.max_heart_rate);
          systolic = alertRandHigh(t.max_bp);
          diastolic = alertRandHigh(t.max_bp);
        } else {
          heartRate = alertRandLow(t.min_heart_rate);
          systolic = alertRandLow(t.min_bp);
          diastolic = alertRandLow(t.min_bp);
        }
      }

      const now = Math.floor(Date.now() / 1000);

      await GarminHeartRate.create({
        user_id: userId,
        encoded_user_id: encodedId,
        timestamp: now,
        heart_rate: heartRate,
        source: "epoch"
      });

      await GarminBloodPressure.create({
        user_id: userId,
        encoded_user_id: encodedId,
        measurement_time: now,
        systolic,
        diastolic,
        pulse: heartRate,
        summary_id: `bp-${userId}-${now}`
      });

      console.log(`Inserted for user ${userId}:`, {
        HR: heartRate,
        SYS: systolic,
        DIA: diastolic,
        threshold: {
          hr: `${t.min_heart_rate}-${t.max_heart_rate}`,
          bp: `${t.min_bp}-${t.max_bp}`
        },
        mode: toggle ? "🚨 ALERT" : "✅ SAFE"
      });
    }

    toggle = !toggle;

  } catch (err) {
    console.log("SEEDER ERROR:", err);
  }
};

// ===== CRON =====
const startSeederCron = () => {
  cron.schedule(process.env.SEEDERCRON, async () => {
    await insertHealthData();
  });

  console.log("✅ Seeder Cron Started (Every 2 minutes)");
};

module.exports = { startSeederCron };