const cron = require('node-cron');

const GarminHeartRate = require('../models/garminHeartRates');
const GarminBloodPressure = require('../models/garminBloodPressure');
const UserThreshold = require('../models/userThreshold');

let toggle = false;

const safeRand = (min, max, buffer = 5) => {
  if (max - min <= buffer * 2) {
    return Math.floor((min + max) / 2);
  }

  return Math.floor(Math.random() * (max - min - buffer * 2 + 1)) + (min + buffer);
};

const alertRandHigh = (max) => max + Math.floor(Math.random() * 40) + 5;
const alertRandLow = (min) => Math.max(1, min - Math.floor(Math.random() * 30) - 5);

const insertHealthData = async () => {
  try {
    console.log("SEEDER RUN", new Date());

    const thresholds = await UserThreshold.find({}).lean();

    for (const threshold of thresholds) {
      const userId = threshold.user_id;
      const encodedId = `enc-${userId}`;

      let heartRate;
      let systolic;
      let diastolic;

      if (!toggle) {
        heartRate = safeRand(threshold.min_heart_rate, threshold.max_heart_rate);
        systolic = safeRand(threshold.min_bp, threshold.max_bp);
        diastolic = safeRand(threshold.min_bp, threshold.max_bp - 5);
      } else {
        const isHigh = Math.random() > 0.5;

        if (isHigh) {
          heartRate = alertRandHigh(threshold.max_heart_rate);
          systolic = alertRandHigh(threshold.max_bp);
          diastolic = alertRandHigh(threshold.max_bp);
        } else {
          heartRate = alertRandLow(threshold.min_heart_rate);
          systolic = alertRandLow(threshold.min_bp);
          diastolic = alertRandLow(threshold.min_bp);
        }
      }

      const now = Math.floor(Date.now() / 1000);

      await GarminHeartRate.create({
        user_id: userId,
        encoded_user_id: encodedId,
        timestamp: now,
        heart_rate: heartRate,
        source: 'epoch'
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
          hr: `${threshold.min_heart_rate}-${threshold.max_heart_rate}`,
          bp: `${threshold.min_bp}-${threshold.max_bp}`
        },
        mode: toggle ? 'ALERT' : 'SAFE'
      });
    }

    toggle = !toggle;
  } catch (err) {
    console.log("SEEDER ERROR:", err);
  }
};

const startSeederCron = () => {
  cron.schedule(process.env.SEEDERCRON, async () => {
    await insertHealthData();
  });

  console.log("Seeder Cron Started");
};

module.exports = { startSeederCron };
