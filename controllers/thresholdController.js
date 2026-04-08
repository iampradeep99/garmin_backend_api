const { validationResult } = require('express-validator');

const { sendResponse } = require('../middlewares/common');
const logger = require('../utils/logger');
const UserThreshold = require('../models/userThreshold');
const GarminBloodPressure = require('../models/garminBloodPressure');
const GarminHeartRate = require('../models/garminHeartRates');

async function addThreshold(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendResponse(res, '400', errors.array()[0].msg, errors.array());
    }



    const user_id = req.user.user_id;
    let payload = {
      user_id:user_id,
      min_heart_rate:req.body.minHeartRate,
      max_heart_rate:req.body.maxHeartRate,
      min_bp:req.body.minBp,
      max_bp:req.body.maxBp,
      alert_email:req.body.alertEmail,
      alert_mobile:req.body.alertMobile
    } 
    


    const existing = await UserThreshold.findOne({ user_id }).lean();
    if (existing) {
      return sendResponse(res, '400', 'Threshold already exists. Use PUT to update.', []);
    }
   
    const threshold = await UserThreshold.create(payload);

    console.log(threshold, "threshold")

    return sendResponse(res, '200', 'Threshold added successfully', [threshold]);
  } catch (err) {
    console.log(err)
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
    const updateFields = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'minHeartRate')) {
      updateFields.min_heart_rate = req.body.minHeartRate;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'maxHeartRate')) {
      updateFields.max_heart_rate = req.body.maxHeartRate;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'minBp')) {
      updateFields.min_bp = req.body.minBp;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'maxBp')) {
      updateFields.max_bp = req.body.maxBp;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'alertEmail')) {
      updateFields.alert_email = req.body.alertEmail;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'alertMobile')) {
      updateFields.alert_mobile = req.body.alertMobile;
    }

    const threshold = await UserThreshold.findOneAndUpdate(
      { user_id },
      { $set: updateFields },
      { returnDocument: 'after', upsert: false }
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

function evaluateBloodPressure(latestBP, threshold, alerts) {
  let hasAlert = false;

  if (!latestBP) {
    return hasAlert;
  }

  const systolic = Number(latestBP.systolic);
  const diastolic = Number(latestBP.diastolic);
  const maxBP = Number(threshold.max_bp);
  const minBP = Number(threshold.min_bp);

  if (systolic > maxBP) {
    alerts.push(`High Systolic BP ${systolic}`);
    hasAlert = true;
  }

  if (systolic < minBP) {
    alerts.push(`Low Systolic BP ${systolic}`);
    hasAlert = true;
  }

  if (diastolic > maxBP) {
    alerts.push(`High Diastolic BP ${diastolic}`);
    hasAlert = true;
  }

  if (diastolic < minBP) {
    alerts.push(`Low Diastolic BP ${diastolic}`);
    hasAlert = true;
  }

  return hasAlert;
}

function evaluateHeartRate(latestHR, threshold, alerts) {
  let hasAlert = false;

  if (!latestHR) {
    return hasAlert;
  }

  const heartRate = Number(latestHR.heart_rate);
  const maxHR = Number(threshold.max_heart_rate);
  const minHR = Number(threshold.min_heart_rate);

  if (heartRate > maxHR) {
    alerts.push(`High Heart Rate ${heartRate}`);
    hasAlert = true;
  }

  if (heartRate < minHR) {
    alerts.push(`Low Heart Rate ${heartRate}`);
    hasAlert = true;
  }

  return hasAlert;
}

async function getThreshold(req, res) {
  try {
    const userId = req.user.user_id;

    let getThresholdData = await UserThreshold.findOne({user_id:userId});
    if (!getThresholdData){
     return sendResponse(res, '404', 'No Record Found', []);

    }else{
     return sendResponse(res, '200', 'Fetched', [getThresholdData]);

    }
  } catch (err) {
    logger.error('Get threshold error', err);
    return sendResponse(res, '500', 'Internal server error', []);
  }
}

module.exports = {
  addThreshold,
  updateThreshold,
  getThreshold
};
