

// const http = require('http');
// const debug = require('debug')('garminproject:server');
// const createError = require('http-errors');
// const express = require('express');
// const path = require('path');
// const cookieParser = require('cookie-parser');
// const morgan = require('morgan');
// require('dotenv').config();

// const logger = require('./logger');

// const { startHealthCron } = require('./crons/healthAlertCron');
// const { startSeederCron } = require('./crons/seederCron');
// const { connectMongo } = require('./database/mongo');

// connectMongo();

// const authRouter = require('./routes/auth');
// const usersRouter = require('./routes/users');
// const garminRouter = require('./routes/garmin');
// const garminPushRouter = require('./routes/garminPush');
// const thresholdRouter = require('./routes/threshold');

// startSeederCron();
// startHealthCron();

// const app = express();

// // ❌ REMOVE THESE
// // app.set('views', path.join(__dirname, 'views'));
// // app.set('view engine', 'jade');

// // Morgan → Winston
// app.use(
//   morgan('combined', {
//     stream: {
//       write: (message) => logger.info(message.trim()),
//     },
//   })
// );

// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());

// const publicPath = path.join(process.cwd(), 'public');

// app.use(express.static(publicPath));

// app.get('/', (req, res) => {
//   res.sendFile(path.join(publicPath, 'index.html'));
// });
// // Custom request log
// app.use((req, res, next) => {
//   logger.info(`Incoming Request: ${req.method} ${req.url} | IP: ${req.ip}`);
//   next();
// });

// // Routes
// app.use('/api/auth', authRouter);
// app.use('/users', usersRouter);
// app.use('/api/garmin', garminRouter);
// app.use('/api/garmin/push', garminPushRouter);
// app.use('/api/threshold', thresholdRouter);

// // 404 handler
// app.use(function (req, res, next) {
//   logger.warn(`404 Not Found: ${req.method} ${req.url}`);
//   next(createError(404));
// });

// // ✅ Error handler (HTML instead of Jade)
// app.use(function (err, req, res, next) {
//   logger.error(`Error: ${err.message} | URL: ${req.url} | Method: ${req.method}`);

//   res.status(err.status || 500);

//   res.send(`
//     <html>
//       <head><title>Error</title></head>
//       <body>
//         <h1>Error ${err.status || 500}</h1>
//         <p>${err.message}</p>
//       </body>
//     </html>
//   `);
// });

// const port = normalizePort(process.env.PORT || '3000');
// app.set('port', port);

// const server = http.createServer(app);

// server.listen(port);
// server.on('error', onError);
// server.on('listening', onListening);

// function normalizePort(val) {
//   const port = parseInt(val, 10);
//   if (isNaN(port)) return val;
//   if (port >= 0) return port;
//   return false;
// }

// function onError(error) {
//   if (error.syscall !== 'listen') throw error;

//   const bind =
//     typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

//   logger.error(`Server Error: ${error.code} on ${bind}`);

//   switch (error.code) {
//     case 'EACCES':
//       logger.error(bind + ' requires elevated privileges');
//       process.exit(1);
//     case 'EADDRINUSE':
//       logger.error(bind + ' is already in use');
//       process.exit(1);
//     default:
//       throw error;
//   }
// }

// function onListening() {
//   const addr = server.address();
//   const bind =
//     typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

//   logger.info(`Server started on ${bind}`);
//   debug('Listening on ' + bind);
//   console.log(`Server running on http://localhost:${addr.port}`);
// }


const http = require('http');
const debug = require('debug')('garminproject:server');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const logger = require('./logger');
const swaggerDocument = require('./docs/swagger');

const { startHealthCron } = require('./crons/healthAlertCron');
const { startSeederCron } = require('./crons/seederCron');
const { connectMongo } = require('./database/mongo');

connectMongo();

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const garminRouter = require('./routes/garmin');
const garminPushRouter = require('./routes/garminPush');
const garminPingRouter = require('./routes/garminPing');
const thresholdRouter = require('./routes/threshold');

startSeederCron();
startHealthCron();

const app = express();

// Morgan → Winston
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ✅ Static public folder
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// ✅ Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/api-docs.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use('/api-docs', express.static(path.join(publicPath, 'swagger')));

// Logging
app.use((req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.url} | IP: ${req.ip}`);
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/users', usersRouter);
app.use('/api/garmin', garminRouter);
app.use('/api/garmin/push', garminPushRouter);
app.use('/api/garmin/ping', garminPingRouter);
app.use('/api/threshold', thresholdRouter);

// 404
app.use(function (req, res, next) {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
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

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') throw error;

  const bind =
    typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  logger.error(`Server Error: ${error.code} on ${bind}`);

  switch (error.code) {
    case 'EACCES':
      logger.error(bind + ' requires elevated privileges');
      process.exit(1);
    case 'EADDRINUSE':
      logger.error(bind + ' is already in use');
      process.exit(1);
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind =
    typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

  logger.info(`Server started on ${bind}`);
  debug('Listening on ' + bind);
  console.log(`Server running on http://localhost:${addr.port}`);
}
