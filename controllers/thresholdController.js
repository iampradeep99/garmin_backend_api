const { validationResult } = require('express-validator');
const { sendResponse } = require('../middlewares/common');
const logger = require('../utils/logger');
const UserThreshold = require('../models/userThreshold');
const GarminBloodPressureSchema = require('../models/garminBloodPressure')
const GarminHeartRateSchema = require('../models/garminHeartRates')



const {sendEmail} = require('../common/mail')
const {sendSMS} = require('../common/sms')




// async function addThreshold(req, res) {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return sendResponse(res, '400', errors.array()[0].msg, []);
//     }

//     const user_id = req.user.user_id;

//     console.log(req.body)
    

//     const {
//       min_heart_rate,
//       max_heart_rate,
//       min_bp,
//       max_bp,
//       alert_email,
//       alert_mobile
//     } = req.body;

    
//     const existing = await UserThreshold.findOne({ user_id });
//     if (existing) {
//       return sendResponse(res, '400', 'Threshold already exists. Use PUT to update.', []);
//     }

    
//     const threshold = await UserThreshold.create(req.body);

//     return sendResponse(res, '200', 'Threshold added successfully', [threshold]);
//   } catch (err) {
//     console.log(err)
//     logger.error('Add threshold error', err);
//     return sendResponse(res, '500', 'Internal server error', []);
//   }
// }

async function addThreshold(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("VALIDATION ERROR:", errors.array());
      return sendResponse(res, '400', errors.array()[0].msg, errors.array());
    }

    const user_id = req.user.user_id;

    const {
      min_heart_rate,
      max_heart_rate,
      min_bp,
      max_bp,
      alert_email,
      alert_mobile
    } = req.body;

    const existing = await UserThreshold.findOne({ user_id });
    if (existing) {
      return sendResponse(res, '400', 'Threshold already exists. Use PUT to update.', []);
    }

    const threshold = await UserThreshold.create({
      user_id,
      min_heart_rate,
      max_heart_rate,
      min_bp,
      max_bp,
      alert_email,
      alert_mobile
    });

    return sendResponse(res, '200', 'Threshold added successfully', [threshold]);

  } catch (err) {
    console.log(err);
    logger.error('Add threshold error', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}


async function updateThreshold(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendResponse(res, '400', errors.array()[0].msg, []);
    }

    const user_id = req.user.user_id;

    const updateFields = { ...req.body };
    delete updateFields.user_id; // prevent changing user_id

    const threshold = await UserThreshold.findOneAndUpdate(
      { user_id },
      { $set: updateFields },
      { new: true, upsert: false }
    ).lean();

    if (!threshold) {
      return sendResponse(res, '404', 'Threshold not found for this user', []);
    }

    return sendResponse(res, '200', 'Threshold updated successfully', [threshold]);
  } catch (err) {
    logger.error('Update threshold error', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}


// async function getThreshold(req, res) {
//   try {
//     const userId = req.user.user_id;
//     console.log(userId, "userInd")
//     let bpQuery = {
//       user_id:userId
//     }
//     const getBloodPressure = await GarminBloodPressureSchema.findOne(bpQuery).sort({createdAt:-1}).limit(1)
//     console.log(getBloodPressure, "getBloodPressure");


//     const threshold = await UserThreshold.findOne({ user_id: userId }).lean();
//     console.log(threshold, "threshold");
//     if (!threshold) {
//       return sendResponse(res, '404', 'Threshold not found', []);
//     }

//     return sendResponse(res, '200', 'Threshold fetched', [threshold]);
//   } catch (err) {
//     logger.error('Get threshold error', err);
//     return sendResponse(res, '500', 'Internal server error', []);
//   }
// }





async function getThresholdbkp(req, res) {
  try {
    const userId = req.user.user_id;

    const latestBP = await GarminBloodPressureSchema
      .findOne({ user_id: userId })
      .sort({ createdAt: -1 });

    if (!latestBP) {
      return sendResponse(res, '404', 'No BP data found', []);
    }

    const threshold = await UserThreshold
      .findOne({ user_id: userId })
      .lean();

    if (!threshold) {
      return sendResponse(res, '404', 'Threshold not found', []);
    }

    const alerts = [];

    const systolic = latestBP.systolic;
    const diastolic = latestBP.diastolic;
    const pulse = latestBP.pulse;

    if (systolic > threshold.max_bp) {
      alerts.push(`High Systolic BP: ${systolic}`);
    }

    if (systolic < threshold.min_bp) {
      alerts.push(`Low Systolic BP: ${systolic}`);
    }

    if (diastolic > threshold.max_bp) {
      alerts.push(`High Diastolic BP: ${diastolic}`);
    }

    if (diastolic < threshold.min_bp) {
      alerts.push(`Low Diastolic BP: ${diastolic}`);
    }

    if (pulse > threshold.max_heart_rate) {
      alerts.push(`High Heart Rate: ${pulse}`);
    }

    if (pulse < threshold.min_heart_rate) {
      alerts.push(`Low Heart Rate: ${pulse}`);
    }

    if (alerts.length > 0) {
      const alertText = alerts.join('\n');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 16px; color: #333;">
          <h2 style="color: #d9534f;">Health Alert Notification</h2>
          <p>The system has detected abnormal health readings.</p>
          <table style="border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Systolic BP</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${systolic}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Diastolic BP</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${diastolic}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Heart Rate</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${pulse}</td>
            </tr>
          </table>
          <h3 style="margin-top: 16px;">Alerts</h3>
          <pre style="background: #f8f9fa; padding: 10px; border: 1px solid #ddd;">${alertText}</pre>
          <p style="margin-top: 16px;">Please take necessary action or consult a medical professional.</p>
        </div>
      `;

      const emailPromise = threshold.alert_email
        ? sendEmail({
            to: threshold.alert_email,
            subject: "Health Alert Notification",
            text: alertText,
            html: emailHtml
          })
        : null;

      const smsPromise = threshold.alert_mobile
        ? sendSMS({
            to: threshold.alert_mobile,
            message: alertText
          })
        : null;

      const [emailRes, smsRes] = await Promise.allSettled([
        emailPromise,
        smsPromise
      ]);

      if (emailRes && emailRes.status === "fulfilled") {
        if (emailRes.value.success) {
          console.log("Email sent to:", threshold.alert_email);
        } else {
          console.log("Email error:", emailRes.value.error);
        }
      }

      if (smsRes && smsRes.status === "fulfilled") {
        if (smsRes.value.success) {
          console.log("SMS sent to:", threshold.alert_mobile);
        } else {
          console.log("SMS error:", smsRes.value.error);
        }
      }

      console.log("ALERT SENT:", alertText);
    }

    return sendResponse(res, '200', 'Threshold fetched', [
      {
        // threshold,
        // latest_bp: latestBP,
        alerts: alerts.length > 0 ? alerts : "No alerts"
      }
    ]);

  } catch (err) {
    console.log(err);
    logger.error('Get threshold error', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}



async function getThreshold(req, res) {
  try {
    const userId = req.user.user_id;

    const latestBPArr = await GarminBloodPressureSchema
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const latestHRArr = await GarminHeartRateSchema
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const latestBP = latestBPArr[0] || null;
    const latestHR = latestHRArr[0] || null;

    console.log("Latest BP:", latestBP);
    console.log("Latest HR:", latestHR);

    if (!latestBP && !latestHR) {
      return sendResponse(res, '404', 'No health data found', []);
    }

    const threshold = await UserThreshold
      .findOne({ user_id: userId })
      .lean();

    if (!threshold) {
      return sendResponse(res, '404', 'Threshold not found', []);
    }

    const alerts = [];

    let systolic = null;
    let diastolic = null;
    let heartRate = null;

    let bpAlert = false;
    let hrAlert = false;

    // ================= BP CHECK =================
    if (latestBP) {
      systolic = Number(latestBP.systolic);
      diastolic = Number(latestBP.diastolic);

      const maxBP = Number(threshold.max_bp);
      const minBP = Number(threshold.min_bp);

      console.log("BP:", systolic, diastolic, "| Threshold:", minBP, maxBP);

      if (systolic > maxBP) {
        alerts.push(`High Systolic BP ${systolic}`);
        bpAlert = true;
      }

      if (systolic < minBP) {
        alerts.push(`Low Systolic BP ${systolic}`);
        bpAlert = true;
      }

      if (diastolic > maxBP) {
        alerts.push(`High Diastolic BP ${diastolic}`);
        bpAlert = true;
      }

      if (diastolic < minBP) {
        alerts.push(`Low Diastolic BP ${diastolic}`);
        bpAlert = true;
      }
    }

    // ================= HR CHECK =================
    if (latestHR) {
      heartRate = Number(latestHR.heart_rate);

      const maxHR = Number(threshold.max_heart_rate);
      const minHR = Number(threshold.min_heart_rate);

      console.log("HR:", heartRate, "| Threshold:", minHR, maxHR);

      if (heartRate > maxHR) {
        alerts.push(`High Heart Rate ${heartRate}`);
        hrAlert = true;
      }

      if (heartRate < minHR) {
        alerts.push(`Low Heart Rate ${heartRate}`);
        hrAlert = true;
      }
    }

    // ================= ALERT TYPE =================
    let alertType = "None";

    if (bpAlert && hrAlert) {
      alertType = "BP & Heart Rate";
    } else if (bpAlert) {
      alertType = "BP";
    } else if (hrAlert) {
      alertType = "Heart Rate";
    }

    // ================= SEND ALERT =================
    if (alerts.length > 0) {

      // ✅ SIMPLE MESSAGE (DLT SAFE)
      const alertText = `Health Alert: ${alerts.join(', ')}`;

      console.log("FINAL ALERT MESSAGE:", alertText);

      // 📧 EMAIL
      if (threshold.alert_email) {
        try {
          const emailRes = await sendEmail({
            to: threshold.alert_email,
            subject: "Health Alert",
            message: alertText
          });

          if (emailRes?.success) {
            console.log("Email sent:", threshold.alert_email);
          } else {
            console.log("Email error:", emailRes?.error);
          }
        } catch (e) {
          console.log("Email exception:", e);
        }
      }

      // 📱 SMS
      if (threshold.alert_mobile) {
        try {
          console.log("Sending SMS to:", threshold.alert_mobile);

          const smsRes = await sendSMS({
            to: threshold.alert_mobile,
            message: alertText
          });

          if (smsRes?.success) {
            console.log("SMS sent:", threshold.alert_mobile);
          } else {
            console.log("SMS error:", smsRes?.error);
          }
        } catch (e) {
          console.log("SMS exception:", e);
        }
      }

      console.log("ALERT SENT:", alertText);
    }

    return sendResponse(res, '200', 'Threshold fetched', [
      {
        alert_type: alertType,
        alerts: alerts.length > 0 ? alerts : "No alerts"
      }
    ]);

  } catch (err) {
    console.log(err);
    logger.error('Get threshold error', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}
module.exports = {
  addThreshold,
  updateThreshold,
  getThreshold
};