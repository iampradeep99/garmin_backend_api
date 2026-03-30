const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GARMIN_ALERT_GMAIL_USER;
const GMAIL_PASS = process.env.GARMIN_ALERT_GMAIL_PASS;
const DEFAULT_TO = process.env.GARMIN_PUSH_ALERT_TO || GMAIL_USER;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS
  }
});

function normalizeRecipients(to) {
  return (to || DEFAULT_TO || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function sendGarminAlertEmail({ to, subject, text, html }) {
  try {
    const recipients = normalizeRecipients(to);

    if (!GMAIL_USER || !GMAIL_PASS) {
      return {
        success: false,
        error: 'GARMIN_ALERT_GMAIL_USER or GARMIN_ALERT_GMAIL_PASS is missing'
      };
    }

    if (!recipients.length) {
      return {
        success: false,
        error: 'No Garmin alert email recipient configured'
      };
    }

    const info = await transporter.sendMail({
      from: `"Garmin Push Alerts" <${GMAIL_USER}>`,
      to: recipients.join(', '),
      subject,
      text,
      html
    });

    console.log('GARMIN ALERT EMAIL SENT:', info.response);

    return {
      success: true,
      data: info.response
    };
  } catch (error) {
    console.log('GARMIN ALERT EMAIL ERROR:', error.message);

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendGarminAlertEmail
};
