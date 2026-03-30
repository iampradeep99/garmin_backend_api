

const fs = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), 'garmin-logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const getLogFilePath = (level) => {
  const date = new Date().toISOString().split('T')[0];
  const fileName = level === 'error' ? `error-${date}.log` : `garmin-app-level-${date}.log`;
  return path.join(logDir, fileName);
};

const formatLogMessage = (level, message, stack) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}\n`;
};

const rotateLogs = () => {
  fs.readdir(logDir, (err, files) => {
    if (err) throw err;

    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < fourteenDaysAgo) {
        fs.unlinkSync(filePath);
      }
    });
  });
};

class Logger {
  constructor() {
    this.levels = ['info', 'warn', 'error'];
  }

  log(level, message) {
    if (!this.levels.includes(level)) {
      console.error('Invalid log level');
      return;
    }

    const logMessage = formatLogMessage(level, message);

    const logFilePath = getLogFilePath(level);
    fs.appendFileSync(logFilePath, logMessage, 'utf8');

    if (process.env.NODE_ENV !== 'production') {
      console.log(logMessage);
    }
  }

  info(message) {
    this.log('info', message);
  }

  warn(message) {
    this.log('warn', message);
  }

  error(message, stack) {
    this.log('error', message, stack);
  }
}

const logger = new Logger();

setInterval(rotateLogs, 24 * 60 * 60 * 1000);

module.exports = logger;

