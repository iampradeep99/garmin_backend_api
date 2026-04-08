const AppUser = require('../models/appUser');
const AlertLog = require('../models/alertLog');
const GarminHeartRate = require('../models/garminHeartRates');
const UserThreshold = require('../models/userThreshold');
const { sendEmail } = require('../common/mail');
const { sendSMS } = require('../common/sms');

async function getLatestMetricReading(userId, metricType) {
  if (metricType === 'heart_rate') {
    return GarminHeartRate.findOne({ user_id: userId }).sort({ createdAt: -1 }).lean();
  }

  return null;
}

async function getCandidateReadings(job) {
  const sourceIds = (job?.payload?.source_ids || []).filter(Boolean);

  if (!sourceIds.length) {
    const latest = await getLatestMetricReading(job.user_id, job.metric_type);
    return latest ? [latest] : [];
  }

  if (job.metric_type === 'heart_rate') {
    return GarminHeartRate.find({
      _id: { $in: sourceIds }
    })
      .sort({ createdAt: -1, timestamp: -1 })
      .lean();
  }

  return [];
}

function buildHeartRateAlerts(reading, threshold) {
  const alerts = [];
  const codes = [];
  const hr = Number(reading?.heart_rate);

  if (Number.isNaN(hr)) {
    return { alerts, codes };
  }

  if (threshold.max_heart_rate != null && hr > Number(threshold.max_heart_rate)) {
    alerts.push(`High Heart Rate (${hr} bpm)`);
    codes.push('HIGH_HR');
  }

  if (threshold.min_heart_rate != null && hr < Number(threshold.min_heart_rate)) {
    alerts.push(`Low Heart Rate (${hr} bpm)`);
    codes.push('LOW_HR');
  }

  return { alerts, codes };
}

async function hasAlertForReference(userId, alertKey, referenceId) {
  if (!referenceId) {
    return false;
  }

  const existing = await AlertLog.findOne({
    user_id: userId,
    alert_key: alertKey,
    reference_id: String(referenceId)
  }).lean();

  return Boolean(existing);
}

async function dispatchThresholdAlert({ user, threshold, metricType, alerts, alertCodes, referenceId, jobId }) {
  if (!threshold.alert_email && !threshold.alert_mobile) {
    return {
      status: 'skipped',
      reason: 'No alert recipients configured'
    };
  }

  const alertKey = `${metricType}:${alertCodes.slice().sort().join('|')}`;

  if (await hasAlertForReference(user.user_id, alertKey, referenceId)) {
    return {
      status: 'skipped',
      reason: 'Alert already sent for this reading'
    };
  }

  const message = alerts.join(', ');
  const name = user.fullname || 'User';

  let emailStatus = false;
  let emailError = null;
  let smsStatus = false;
  let smsError = null;

  if (threshold.alert_email) {
    const emailRes = await sendEmail({
      to: threshold.alert_email,
      name,
      bpm: message
    });

    emailStatus = Boolean(emailRes?.success);
    if (!emailStatus) {
      emailError = emailRes?.error || 'Email delivery failed';
    }
  }

  if (threshold.alert_mobile) {
    const smsRes = await sendSMS({
      to: threshold.alert_mobile,
      name,
      bpm: message
    });

    smsStatus = Boolean(smsRes?.success);
    if (!smsStatus) {
      smsError = smsRes?.error || 'SMS delivery failed';
    }
  }

  const deliveryStatus =
    emailStatus && smsStatus
      ? 'BOTH_SENT'
      : emailStatus
      ? 'EMAIL_ONLY'
      : smsStatus
      ? 'SMS_ONLY'
      : 'FAILED';

  await AlertLog.create({
    user_id: user.user_id,
    email: threshold.alert_email || null,
    mobile: threshold.alert_mobile || null,
    message,
    alert_type: alertCodes.join(','),
    alert_key: alertKey,
    reference_id: referenceId ? String(referenceId) : null,
    source_metric: metricType,
    job_id: jobId ? String(jobId) : null,
    email_sent: emailStatus,
    sms_sent: smsStatus,
    delivery_status: deliveryStatus,
    email_error: emailError,
    sms_error: smsError
  });

  if (deliveryStatus === 'FAILED') {
    throw new Error(emailError || smsError || 'Alert delivery failed');
  }

  return {
    status: 'completed',
    deliveryStatus,
    alertKey
  };
}

async function evaluateAndDispatchAlertForJob(job) {
  if (job.metric_type !== 'heart_rate') {
    return { status: 'skipped', reason: `Unsupported metric type: ${job.metric_type}` };
  }

  const [user, threshold, readings] = await Promise.all([
    AppUser.findOne({ user_id: job.user_id }).lean(),
    UserThreshold.findOne({ user_id: job.user_id }).lean(),
    getCandidateReadings(job)
  ]);

  if (!user) {
    return { status: 'skipped', reason: 'User not found' };
  }

  if (!threshold) {
    return { status: 'skipped', reason: 'Threshold not configured' };
  }

  if (!readings.length) {
    return { status: 'skipped', reason: 'No candidate reading found' };
  }

  const triggered = readings
    .map((reading) => ({
      reading,
      comparison: buildHeartRateAlerts(reading, threshold)
    }))
    .find((entry) => entry.comparison.alerts.length > 0);

  if (!triggered) {
    return { status: 'skipped', reason: 'Reading is within threshold' };
  }

  return dispatchThresholdAlert({
    user,
    threshold,
    metricType: job.metric_type,
    alerts: triggered.comparison.alerts,
    alertCodes: triggered.comparison.codes,
    referenceId: triggered.reading._id,
    jobId: job._id
  });
}

module.exports = {
  evaluateAndDispatchAlertForJob
};
