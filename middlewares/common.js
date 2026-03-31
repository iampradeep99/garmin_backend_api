function sendResponse(res, statusCode, statusMessage, data = []) {
  return res.status(parseInt(statusCode)).json({
    statusCode,
    statusMessage,
    data
  });
}

function generate10DigitId() {
  const timestampPart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return timestampPart + randomPart;
}

module.exports = {
  sendResponse,
  generate10DigitId
};
