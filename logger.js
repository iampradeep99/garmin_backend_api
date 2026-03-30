const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');

// create logs folder if not exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new transports.File({ filename: path.join(logDir, 'error.txt'), level: 'error' }),
    new transports.File({ filename: path.join(logDir, 'combined.txt') }),
    new transports.Console()
  ],
});

module.exports = logger;