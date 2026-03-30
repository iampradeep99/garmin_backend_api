const crypto = require('crypto');

function verifyGarminWebhook(req, res, next) {
  try {
    const signature = req.headers['x-garmin-signature'];
    const timestamp = req.headers['x-garmin-timestamp'];

    console.log(timestamp, "timestamp")
    if (!signature || !timestamp) {
      return res.status(401).send('Unauthorized');
    }

    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', process.env.GARMIN_CLIENT_SECRET)
      .update(body + timestamp)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(401).send('Invalid signature');
    }

    next();
  } catch (err) {
    return res.status(401).send('Unauthorized');
  }
}

module.exports = {verifyGarminWebhook};
