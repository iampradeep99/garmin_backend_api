const nodemailer = require('nodemailer');

const MAIL_USER = process.env.GARMIN_ALERT_GMAIL_USER;
const MAIL_PASS = process.env.GARMIN_ALERT_GMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS
  }
});

function buildResetUrl(token) {
  const baseUrl = process.env.PASSWORD_RESET_BASE_URL;

  if (!baseUrl) return null;

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail({ to, name = 'User', token, expiresInMinutes }) {
  if (!MAIL_USER || !MAIL_PASS) {
    return { success: false, error: 'Password reset email credentials are not configured' };
  }

  if (!to || !token) {
    return { success: false, error: 'Recipient email and token are required' };
  }

  const resetUrl = buildResetUrl(token);
  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset your password.',
    `Your password reset token is: ${token}`,
    `This token will expire in ${expiresInMinutes} minutes.`,
    resetUrl ? `Reset link: ${resetUrl}` : '',
    '',
    'If you did not request this, you can safely ignore this email.',
    '',
    'Regards,',
    'FitZen Team'
  ].filter(Boolean).join('\n');
  const html = `
    <p>Hi ${name},</p>
    <p>We received a request to reset your password.</p>
    <p>Your password reset token is:</p>
    <p><b>${token}</b></p>
    <p>This token will expire in ${expiresInMinutes} minutes.</p>
    ${resetUrl ? `<p>You can also use this link: <a href="${resetUrl}">${resetUrl}</a></p>` : ''}
    <p>If you did not request this, you can safely ignore this email.</p>
    <p>Regards,<br/>FitZen Team</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"FitZen" <${MAIL_USER}>`,
      to,
      subject: 'FitZen Password Reset',
      text,
      html
    });

    console.log('PASSWORD RESET EMAIL SENT:', info.response);

    return { success: true, data: info.response };
  } catch (err) {
    console.log('PASSWORD RESET EMAIL ERROR:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendPasswordResetEmail
};
