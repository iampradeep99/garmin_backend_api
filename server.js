const http = require('http');
const axios = require('axios');
const debug = require('debug')('garminproject:server');
const createError = require('http-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const logger = require('./logger');
const swaggerDocument = require('./docs/swagger');
const { startAlertJobWorker } = require('./services/alertJobService');
const { startSeederCron } = require('./crons/seederCron');
const { connectMongo } = require('./database/mongo');

connectMongo();

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const garminRouter = require('./routes/garmin');
const garminPushRouter = require('./routes/garminPush');
const garminPingRouter = require('./routes/garminPing');
const thresholdRouter = require('./routes/threshold');
const buildRouter = require('./routes/builds');
const adminRouter = require('./routes/admin');
const statusReportUrl = process.env.STATUS_REPORT_URL || 'http://localhost:3005/status/report';
const statusSharedSecret = process.env.STATUS_SHARED_SECRET || '';
const statusPublicUrl = process.env.STATUS_PUBLIC_URL || 'http://localhost:3005/';

startSeederCron();
startAlertJobWorker();

const app = express();

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors({
  origin: '*'
}));

const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));
app.use('/build-center', express.static(path.join(publicPath, 'build-center')));

app.get('/', (req, res) => {
  res.redirect(statusPublicUrl);
    // res.send("Main API running on 3002");
});

app.get('/health', (req, res) => {
  res.status(isShuttingDown ? 503 : 200).json({
    ok: !isShuttingDown,
    status: isShuttingDown ? 'shutting_down' : 'online',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api-docs.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use('/api-docs', express.static(path.join(publicPath, 'swagger')));

app.use((req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.url} | IP: ${req.ip}`);
  next();
});

app.use('/api/auth', authRouter);
app.use('/users', usersRouter);
app.use('/api/garmin', garminRouter);
app.use('/api/garmin/push', garminPushRouter);
app.use('/api/garmin/ping', garminPingRouter);
app.use('/api/threshold', thresholdRouter);
app.use('/api/builds', buildRouter);
app.use('/api/admin', adminRouter);

app.use((req, res, next) => {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  next(createError(404));
});

app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message} | URL: ${req.url} | Method: ${req.method}`);

  res.status(err.status || 500).send(`
    <html>
      <head><title>Error</title></head>
      <body>
        <h1>Error ${err.status || 500}</h1>
        <p>${err.message}</p>
      </body>
    </html>
  `);
});

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const server = http.createServer(app);
let isShuttingDown = false;

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function normalizePort(val) {
  const parsedPort = parseInt(val, 10);
  if (isNaN(parsedPort)) return val;
  if (parsedPort >= 0) return parsedPort;
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') throw error;

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  logger.error(`Server Error: ${error.code} on ${bind}`);

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  const backendOrigin = typeof addr === 'string' ? process.env.STATUS_BACKEND_ORIGIN || '' : `http://localhost:${addr.port}`;

  logger.info(`Server started on ${bind}`);
  debug(`Listening on ${bind}`);
  console.log(`Server running on http://localhost:${addr.port}`);
  void reportStatus('online', {
    ok: true,
    backend_origin: backendOrigin,
    source: 'backend_start'
  });
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`Graceful shutdown started on ${signal}`);
  void reportStatus('shutting_down', {
    ok: false,
    backend_origin: `http://localhost:${port}`,
    source: signal
  });

  server.close((error) => {
    if (error) {
      logger.error('Graceful shutdown failed', error);
      process.exit(1);
      return;
    }

    logger.info('HTTP server closed successfully');
    reportStatus('offline', {
      ok: false,
      backend_origin: `http://localhost:${port}`,
      source: 'server_closed'
    }).finally(() => {
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

async function reportStatus(status, payload = {}) {
  try {
    await axios.post(
      statusReportUrl,
      {
        status,
        checked_at: new Date().toISOString(),
        ...payload
      },
      {
        timeout: 2000,
        headers: statusSharedSecret ? { 'x-status-secret': statusSharedSecret } : {}
      }
    );
  } catch (error) {
    logger.warn(`Status report failed: ${error.message}`);
  }
}
