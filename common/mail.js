const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.rediffmailpro.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  name: "infodartmail.com",
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async ({ to, name = "User", bpm = 0 }) => {
  try {
    if (!to) {
      console.log("EMAIL SKIPPED: No recipient");
      return { success: false };
    }

    const html = `
      <p>Dear Concerned Team,</p>
      <p>
      ITL Health Alert: ${name}'s heart rate has been recorded at <b>${bpm} bpm</b>.
      Please review the individual's status at the earliest.
      </p>
      <p>Warm Regards,<br/>FitZen Team</p>
    `;

    const info = await transporter.sendMail({
      from: `"FitZen" <${process.env.EMAIL_USER}>`,
      to,
      subject: "FitZen : Heart Rate Alert",
      html
    });

    console.log("EMAIL SENT:", info.response);
    return { success: true };
  } catch (err) {
    console.log("EMAIL ERROR:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail };
