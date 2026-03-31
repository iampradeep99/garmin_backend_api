const axios = require('axios');

const SmsConfig = {
  SMS_URL: "https://pgapi.smartping.ai/fe/api/v1/send",
  USERNAME: process.env.SMS_USERNAME,
  PASSWORD: process.env.SMS_PASSWORD,
  FROM: "ITL",
  PRINCIPAL_ENTITY_ID: "1701176179987054079",
  CONTENT_ID: "1707176526216703569"
};

const formatMobile = (num) => {
  if (!num) return null;

  let clean = num.toString().replace(/\D/g, '');

  if (clean.length === 10) clean = `91${clean}`;
  if (clean.length !== 12) return null;

  return clean;
};

const sendSMS = async ({ to, name = "User", bpm = 0 }) => {
  try {
    const mobile = formatMobile(to);

    if (!mobile) {
      console.log("SMS SKIPPED: Invalid mobile ->", to);
      return { success: false };
    }

    const text = `ITL Health Alert: ${name}'s heart rate has been recorded at ${bpm} bpm. Please review the individual's status at the earliest. Infodart`;

    const params = new URLSearchParams({
      username: SmsConfig.USERNAME,
      password: SmsConfig.PASSWORD,
      unicode: "true",
      from: SmsConfig.FROM,
      to: mobile,
      dltPrincipalEntityId: SmsConfig.PRINCIPAL_ENTITY_ID,
      dltContentId: SmsConfig.CONTENT_ID,
      text
    });

    console.log("Sending SMS:", mobile);

    const response = await axios.post(
      SmsConfig.SMS_URL,
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const data = response.data;

    console.log("SMS RESPONSE:", data);

    if (data?.statusCode === 200 || data?.state === "SUBMIT_ACCEPTED") {
      console.log("SMS SENT SUCCESS");
      return { success: true };
    }

    return { success: false, error: data };
  } catch (err) {
    console.log("SMS ERROR:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendSMS };
