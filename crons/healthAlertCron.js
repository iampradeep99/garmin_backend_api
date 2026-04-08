const cron = require('node-cron');

const User = require('../models/appUser');
const GarminHeartRateSchema = require('../models/garminHeartRates');
const UserThreshold = require('../models/userThreshold');
const AlertLog = require('../models/alertLog');
const { sendEmail } = require('../common/mail');
const { sendSMS } = require('../common/sms');

const runHealthCheck = async () => {
  try {
    console.log("CRON STARTED:", new Date());

    const users = await User.find({}).lean();
    console.log("USERS FOUND:", users.length);

    for (const user of users) {
      try {
        const userId = user.user_id;
        console.log("Checking user:", userId);

        const latestHR = await GarminHeartRateSchema.findOne({ user_id: userId })
          .sort({ createdAt: -1 })
          .lean();

        const threshold = await UserThreshold.findOne({ user_id: userId }).lean();

        if (!threshold) {
          console.log("No threshold");
          continue;
        }

        const alerts = [];
        const alertTypes = [];

        if (latestHR) {
          const hr = Number(latestHR.heart_rate);

          if (!isNaN(hr)) {
            if (hr > threshold.max_heart_rate) {
              alerts.push(`High Heart Rate (${hr} bpm)`);
              alertTypes.push("HIGH_HR");
            } else if (hr < threshold.min_heart_rate) {
              alerts.push(`Low Heart Rate (${hr} bpm)`);
              alertTypes.push("LOW_HR");
            }
          }
        } else {
          console.log("No HR data");
        }

        if (alerts.length === 0) {
          console.log("ALL NORMAL");
          continue;
        }

        const name = user.fullname || "User";
        console.log(`ALERT for ${userId}:`, alerts);

        const combinedMessage = alerts.join(', ');

        let emailStatus = false;
        let emailError = null;

        if (threshold.alert_email) {
          const result = await sendEmail({
            to: threshold.alert_email,
            name,
            bpm: combinedMessage
          });

          emailStatus = result.success;
          if (!result.success) emailError = result.error;
        }

        let smsStatus = false;
        let smsError = null;

        if (threshold.alert_mobile) {
          const result = await sendSMS({
            to: threshold.alert_mobile,
            name,
            bpm: combinedMessage
          });

          smsStatus = result.success;
          if (!result.success) smsError = result.error;
        }

        const deliveryStatus =
          emailStatus && smsStatus
            ? "BOTH_SENT"
            : emailStatus
            ? "EMAIL_ONLY"
            : smsStatus
            ? "SMS_ONLY"
            : "FAILED";

        console.log(`STATUS ${userId}:`, deliveryStatus);

        await AlertLog.create({
          user_id: userId,
          email: threshold.alert_email || null,
          mobile: threshold.alert_mobile || null,
          message: combinedMessage,
          alert_type: [...new Set(alertTypes)].join(','),
          reference_id: latestHR?._id || null,
          email_sent: emailStatus,
          sms_sent: smsStatus,
          delivery_status: deliveryStatus,
          email_error: emailError,
          sms_error: smsError
        });
      } catch (err) {
        console.log("USER ERROR:", err);
      }
    }

    console.log("CRON COMPLETED");
  } catch (err) {
    console.log("CRON ERROR:", err);
  }
};

const startHealthCron = () => {
  console.log("STARTING CRON");

  if (!process.env.HEALTHCRON) {
    console.log("HEALTHCRON is not configured");
    return;
  }

  cron.schedule(process.env.HEALTHCRON, async () => {
    console.log("CRON TRIGGERED");
    await runHealthCheck();
  });

  console.log("Health Alert Cron Started");
};

module.exports = {
  startHealthCron,
  runHealthCheck
};
