function sendResponse(res, statusCode, statusMessage, data = []) {
  return res.status(parseInt(statusCode)).json({
    statusCode: statusCode,
    statusMessage: statusMessage,
    data: data
  });
}

function generate10DigitId() {
  const timestampPart = Date.now().toString().slice(-6); // last 6 digits of timestamp
  const randomPart = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return timestampPart + randomPart;
}


module.exports = {
  sendResponse,
  generate10DigitId
}
