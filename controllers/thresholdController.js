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
    const {
      min_heart_rate,
      max_heart_rate,
      min_bp,
      max_bp,
      alert_email,
      alert_mobile
    } = req.body;

    const existing = await UserThreshold.findOne({ user_id }).lean();
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
    delete updateFields.user_id;

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

    const [latestBP, latestHR, threshold] = await Promise.all([
      GarminBloodPressure.findOne({ user_id: userId }).sort({ createdAt: -1 }).lean(),
      GarminHeartRate.findOne({ user_id: userId }).sort({ createdAt: -1 }).lean(),
      UserThreshold.findOne({ user_id: userId }).lean()
    ]);

    if (!latestBP && !latestHR) {
      return sendResponse(res, '404', 'No health data found', []);
    }

    if (!threshold) {
      return sendResponse(res, '404', 'Threshold not found', []);
    }

    const alerts = [];
    const bpAlert = evaluateBloodPressure(latestBP, threshold, alerts);
    const hrAlert = evaluateHeartRate(latestHR, threshold, alerts);

    let alert_type = 'None';

    if (bpAlert && hrAlert) {
      alert_type = 'BP & Heart Rate';
    } else if (bpAlert) {
      alert_type = 'BP';
    } else if (hrAlert) {
      alert_type = 'Heart Rate';
    }

    return sendResponse(res, '200', 'Threshold fetched', [
      {
        alert_type,
        alerts: alerts.length ? alerts : 'No alerts'
      }
    ]);
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
