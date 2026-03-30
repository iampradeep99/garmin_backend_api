

// const cron = require('node-cron');

// const User = require('../models/appUser');
// const GarminBloodPressureSchema = require('../models/garminBloodPressure');
// const GarminHeartRateSchema = require('../models/garminHeartRates');
// const UserThreshold = require('../models/userThreshold');
// const AlertLog = require('../models/alertLog');

// const { sendEmail } = require('../common/mail');
// const { sendSMS } = require('../common/sms');

// // ===== MAIN FUNCTION =====
// // const runHealthCheck = async () => {
// //   try {
// //     console.log("CRON STARTED ====================", new Date());

// //     const users = await User.find({}).lean();

// //     for (const user of users) {
// //       try {
// //         const userId = user.user_id;

// //         const latestBP = await GarminBloodPressureSchema
// //           .findOne({ user_id: userId })
// //           .sort({ createdAt: -1 })
// //           .lean();

// //         const latestHR = await GarminHeartRateSchema
// //           .findOne({ user_id: userId })
// //           .sort({ createdAt: -1 })
// //           .lean();

// //         if (!latestBP && !latestHR) continue;

// //         const threshold = await UserThreshold
// //           .findOne({ user_id: userId })
// //           .lean();

// //         if (!threshold) continue;

// //         const alerts = [];
// //         let alertType = [];

// //         // ===== BP CHECK =====
// //         if (latestBP) {
// //           const systolic = Number(latestBP.systolic);
// //           const diastolic = Number(latestBP.diastolic);

// //           const maxBP = Number(threshold.max_bp);
// //           const minBP = Number(threshold.min_bp);

// //           if (systolic > maxBP) {
// //             alerts.push(`High Systolic BP ${systolic}`);
// //             alertType.push("BP");
// //           }

// //           if (systolic < minBP) {
// //             alerts.push(`Low Systolic BP ${systolic}`);
// //             alertType.push("BP");
// //           }

// //           if (diastolic > maxBP) {
// //             alerts.push(`High Diastolic BP ${diastolic}`);
// //             alertType.push("BP");
// //           }

// //           if (diastolic < minBP) {
// //             alerts.push(`Low Diastolic BP ${diastolic}`);
// //             alertType.push("BP");
// //           }
// //         }

// //         // ===== HR CHECK =====
// //         let heartRate = null;

// //         if (latestHR) {
// //           heartRate = Number(latestHR.heart_rate);

// //           const maxHR = Number(threshold.max_heart_rate);
// //           const minHR = Number(threshold.min_heart_rate);

// //           if (heartRate > maxHR) {
// //             alerts.push(`High Heart Rate ${heartRate}`);
// //             alertType.push("HR");
// //           }

// //           if (heartRate < minHR) {
// //             alerts.push(`Low Heart Rate ${heartRate}`);
// //             alertType.push("HR");
// //           }
// //         }

// //         if (alerts.length === 0) continue;

// //         // ===== PREVENT DUPLICATE =====
// //         global.alertCache = global.alertCache || {};
// //         const alertKey = `${userId}_${alerts.join(',')}`;

// //         if (global.alertCache[alertKey]) {
// //           console.log(`Skipping duplicate alert for user ${userId}`);
// //           continue;
// //         }

// //         global.alertCache[alertKey] = true;

// //         // ===== MESSAGE =====
// //         const name = user.fullname || "User";

// //         const smsMessage = heartRate
// //           ? `ITL Health Alert: ${name} heart rate ${heartRate} bpm. Check immediately.`
// //           : `ITL Health Alert: Please check health status.`;

// //         const emailMessage = `Health Alert: ${alerts.join(', ')}`;

// //         console.log(`USER ${userId} ALERT:`, emailMessage);

// //         // ===== EMAIL =====
// //         let emailStatus = false;
// //         let emailError = null;

// //         if (user.email) {
// //           try {
// //             const emailRes = await sendEmail({
// //               to: user.email,
// //               subject: "Health Alert",
// //               message: emailMessage
// //             });

// //             console.log("EMAIL RESPONSE:", emailRes);

// //             emailStatus = emailRes?.success === true;
// //           } catch (err) {
// //             emailError = err.message;
// //             console.log("EMAIL ERROR:", err);
// //           }
// //         }

// //         // ===== SMS (MAIN FIX AREA) =====
// //         let smsStatus = false;
// //         let smsError = null;

// //         if (user.mobile_number) {
// //           try {
// //             console.log("Sending SMS to:", user.mobile_number);

// //             const smsRes = await sendSMS({
// //               to: user.mobile_number,
// //               message: smsMessage
// //             });

// //             console.log("SMS RESPONSE FULL:", smsRes);

// //             // IMPORTANT: handle multiple formats
// //             if (
// //               smsRes?.success === true ||
// //               smsRes?.status === "success" ||
// //               smsRes?.Status === "Success"
// //             ) {
// //               smsStatus = true;
// //             } else {
// //               smsError = JSON.stringify(smsRes);
// //             }

// //           } catch (err) {
// //             smsError = err.message;
// //             console.log("SMS ERROR:", err);
// //           }
// //         }

// //         // ===== DELIVERY STATUS =====
// //         const deliveryStatus =
// //           emailStatus && smsStatus
// //             ? "BOTH_SENT"
// //             : emailStatus
// //             ? "EMAIL_ONLY"
// //             : smsStatus
// //             ? "SMS_ONLY"
// //             : "FAILED";

// //         console.log(`DELIVERY STATUS for ${userId}:`, {
// //           email: emailStatus,
// //           sms: smsStatus,
// //           status: deliveryStatus
// //         });

// //         // ===== SAVE LOG =====
// //         await AlertLog.create({
// //           user_id: userId,
// //           email: user.email || null,
// //           mobile: user.mobile_number || null,
// //           message: emailMessage,
// //           alert_type: [...new Set(alertType)].join(','),

// //           reference_id: latestHR?._id || latestBP?._id || null,

// //           email_sent: emailStatus,
// //           sms_sent: smsStatus,
// //           delivery_status: deliveryStatus,

// //           email_error: emailError,
// //           sms_error: smsError
// //         });

// //       } catch (err) {
// //         console.log("User Error:", err);
// //       }
// //     }

// //     console.log("CRON COMPLETED ====================");

// //   } catch (err) {
// //     console.log("CRON ERROR:", err);
// //   }
// // };


// const runHealthCheck = async () => {
//   try {
//     console.log("CRON STARTED ====================", new Date());

//     const users = await User.find({}).lean();

//     for (const user of users) {
//       try {
//         const userId = user.user_id;

//         const latestBP = await GarminBloodPressureSchema
//           .findOne({ user_id: userId })
//           .sort({ createdAt: -1 })
//           .lean();

//         const latestHR = await GarminHeartRateSchema
//           .findOne({ user_id: userId })
//           .sort({ createdAt: -1 })
//           .lean();

//         if (!latestBP && !latestHR) continue;

//         const threshold = await UserThreshold.findOne({ user_id: userId }).lean();
//         if (!threshold) continue;

//         const alerts = [];
//         let alertType = [];

//         // ===== BP =====
//         if (latestBP) {
//           const systolic = Number(latestBP.systolic);
//           const diastolic = Number(latestBP.diastolic);

//           if (systolic > threshold.max_bp) {
//             alerts.push(`High BP ${systolic}`);
//             alertType.push("BP");
//           }

//           if (systolic < threshold.min_bp) {
//             alerts.push(`Low BP ${systolic}`);
//             alertType.push("BP");
//           }

//           if (diastolic > threshold.max_bp) {
//             alerts.push(`High BP ${diastolic}`);
//             alertType.push("BP");
//           }

//           if (diastolic < threshold.min_bp) {
//             alerts.push(`Low BP ${diastolic}`);
//             alertType.push("BP");
//           }
//         }

//         // ===== HR =====
//         let heartRate = null;

//         if (latestHR) {
//           heartRate = Number(latestHR.heart_rate);

//           if (heartRate > threshold.max_heart_rate) {
//             alerts.push(`High HR ${heartRate}`);
//             alertType.push("HR");
//           }

//           if (heartRate < threshold.min_heart_rate) {
//             alerts.push(`Low HR ${heartRate}`);
//             alertType.push("HR");
//           }
//         }

//         if (alerts.length === 0) continue;

//         // ❌ REMOVE DUPLICATE CACHE (IMPORTANT)
//         // global.alertCache = global.alertCache || {};
//         // const alertKey = `${userId}_${alerts.join(',')}`;
//         // if (global.alertCache[alertKey]) continue;

//         const name = user.fullname || "User";

//         const smsMessage = heartRate
//           ? `ITL Alert: ${name} HR ${heartRate} bpm. Check immediately.`
//           : `ITL Alert: Health issue detected. Check immediately.`;

//         const emailMessage = `Health Alert: ${alerts.join(', ')}`;

//         console.log(`USER ${userId} ALERT:`, emailMessage);

//         // ===== EMAIL =====
//         let emailStatus = false;
//         let emailError = null;

//         if (user.email) {
//           try {
//             const res = await sendEmail({
//               to: user.email,
//               subject: "Health Alert",
//               message: emailMessage
//             });

//             emailStatus = res.success;
//           } catch (err) {
//             emailError = err.message;
//           }
//         }

//         // ===== SMS =====
//         let smsStatus = false;
//         let smsError = null;

//         if (user.mobile_number) {
//           try {
//             const res = await sendSMS({
//               to: user.mobile_number,
//               message: smsMessage
//             });

//             smsStatus = res.success;

//             if (!smsStatus) {
//               smsError = JSON.stringify(res.error);
//             }
//           } catch (err) {
//             smsError = err.message;
//           }
//         }

//         // ===== STATUS =====
//         const deliveryStatus =
//           emailStatus && smsStatus
//             ? "BOTH_SENT"
//             : emailStatus
//             ? "EMAIL_ONLY"
//             : smsStatus
//             ? "SMS_ONLY"
//             : "FAILED";

//         console.log("FINAL STATUS:", deliveryStatus);

//         await AlertLog.create({
//           user_id: userId,
//           email: user.email || null,
//           mobile: user.mobile_number || null,
//           message: emailMessage,
//           alert_type: [...new Set(alertType)].join(','),
//           reference_id: latestHR?._id || latestBP?._id || null,
//           email_sent: emailStatus,
//           sms_sent: smsStatus,
//           delivery_status: deliveryStatus,
//           email_error: emailError,
//           sms_error: smsError
//         });

//       } catch (err) {
//         console.log("User Error:", err);
//       }
//     }

//     console.log("CRON COMPLETED ====================");

//   } catch (err) {
//     console.log("CRON ERROR:", err);
//   }
// };
// // ===== CRON =====
// const startHealthCron = () => {
//   cron.schedule(process.env.HEALTHCRON, async () => {
//     await runHealthCheck();
//   });

//   console.log("✅ Health Alert Cron Started (Every 10 seconds)");
// };

// module.exports = {
//   startHealthCron,
//   runHealthCheck
// };



const cron = require('node-cron');

const User = require('../models/appUser');
const GarminHeartRateSchema = require('../models/garminHeartRates');
const GarminBloodPressureSchema = require('../models/garminBloodPressure');
const UserThreshold = require('../models/userThreshold');
const AlertLog = require('../models/alertLog');

const { sendEmail } = require('../common/mail');
const { sendSMS } = require('../common/sms');

const runHealthCheck = async () => {
  try {
    console.log("🚀 CRON STARTED:", new Date());

    const users = await User.find({}).lean();
    console.log("👥 USERS FOUND:", users.length);

    for (const user of users) {
      try {
        const userId = user.user_id;
        console.log("➡️ Checking user:", userId);

        const latestHR = await GarminHeartRateSchema
          .findOne({ user_id: userId })
          .sort({ createdAt: -1 })
          .lean();

        const latestBP = await GarminBloodPressureSchema
          .findOne({ user_id: userId })
          .sort({ createdAt: -1 })
          .lean();

        const threshold = await UserThreshold
          .findOne({ user_id: userId })
          .lean();

        if (!threshold) {
          console.log("❌ No threshold");
          continue;
        }

        let alerts = [];
        let alertTypes = [];

        // ===== HR CHECK =====
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
          console.log("❌ No HR data");
        }

        // ===== BP CHECK =====
        if (latestBP) {
          const sys = Number(latestBP.systolic);
          const dia = Number(latestBP.diastolic);

          if (!isNaN(sys)) {
            if (sys > threshold.max_bp) {
              alerts.push(`High BP Systolic (${sys})`);
              alertTypes.push("HIGH_BP");
            } else if (sys < threshold.min_bp) {
              alerts.push(`Low BP Systolic (${sys})`);
              alertTypes.push("LOW_BP");
            }
          }

          if (!isNaN(dia)) {
            if (dia > threshold.max_bp) {
              alerts.push(`High BP Diastolic (${dia})`);
              alertTypes.push("HIGH_BP");
            } else if (dia < threshold.min_bp) {
              alerts.push(`Low BP Diastolic (${dia})`);
              alertTypes.push("LOW_BP");
            }
          }
        } else {
          console.log("❌ No BP data");
        }

        // ===== NO ALERT =====
        if (alerts.length === 0) {
          console.log("✅ ALL NORMAL → SKIP");
          continue;
        }

        const name = user.fullname || "User";

        console.log(`🚨 ALERT for ${userId}:`, alerts);

        // ===== FINAL MESSAGE =====
        const combinedMessage = alerts.join(', ');

        // ===== EMAIL =====
        let emailStatus = false;
        let emailError = null;

        if (threshold.alert_email) {
          const res = await sendEmail({
            to: threshold.alert_email,
            name,
            bpm: combinedMessage // reuse field
          });

          emailStatus = res.success;
          if (!res.success) emailError = res.error;
        }

        // ===== SMS =====
        let smsStatus = false;
        let smsError = null;

        if (threshold.alert_mobile) {
          const res = await sendSMS({
            to: threshold.alert_mobile,
            name,
            bpm: combinedMessage // reuse field
          });

          smsStatus = res.success;
          if (!res.success) smsError = res.error;
        }

        const deliveryStatus =
          emailStatus && smsStatus
            ? "BOTH_SENT"
            : emailStatus
            ? "EMAIL_ONLY"
            : smsStatus
            ? "SMS_ONLY"
            : "FAILED";

        console.log(`📊 STATUS ${userId}:`, deliveryStatus);

        await AlertLog.create({
          user_id: userId,
          email: threshold.alert_email || null,
          mobile: threshold.alert_mobile || null,
          message: combinedMessage,
          alert_type: [...new Set(alertTypes)].join(','),
          reference_id: latestHR?._id || latestBP?._id || null,
          email_sent: emailStatus,
          sms_sent: smsStatus,
          delivery_status: deliveryStatus,
          email_error: emailError,
          sms_error: smsError
        });

      } catch (err) {
        console.log("❌ USER ERROR:", err);
      }
    }

    console.log("✅ CRON COMPLETED");

  } catch (err) {
    console.log("❌ CRON ERROR:", err);
  }
};

// ===== CRON START =====
const startHealthCron = () => {
  console.log("🔥 STARTING CRON...");

  cron.schedule(process.env.HEALTHCRON, async () => {
    console.log("⏰ CRON TRIGGERED");
    await runHealthCheck();
  });

  console.log("✅ Health Alert Cron Started");
};

module.exports = {
  startHealthCron,
  runHealthCheck
};