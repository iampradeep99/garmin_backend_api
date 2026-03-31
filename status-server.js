const http = require('http');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});
const statusPort = parseInt(process.env.STATUS_PORT || '3005', 10);
const fallbackOrigin = process.env.STATUS_BACKEND_ORIGIN || 'http://localhost:3001';
const statusSharedSecret = process.env.STATUS_SHARED_SECRET || '';
const publicPath = path.join(process.cwd(), 'public', 'status');

let currentHealth = {
  ok: false,
  status: 'checking',
  backend_origin: fallbackOrigin,
  checked_at: new Date().toISOString()
};

app.use(express.json());
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/status/health', (req, res) => {
  const statusCode = currentHealth.ok ? 200 : currentHealth.status === 'checking' ? 202 : 503;
  res.status(statusCode).json(currentHealth);
});

io.on('connection', (socket) => {
  socket.emit('status_update', currentHealth);
});

app.post('/status/report', (req, res) => {
  if (statusSharedSecret && req.headers['x-status-secret'] !== statusSharedSecret) {
    return res.status(401).json({ ok: false, message: 'Unauthorized status report' });
  }

  const nextStatus = req.body?.status || 'offline';
  const nextOk = typeof req.body?.ok === 'boolean' ? req.body.ok : nextStatus === 'online';
  const backendOrigin = req.body?.backend_origin || currentHealth.backend_origin || fallbackOrigin;

  currentHealth = {
    ok: nextOk,
    status: nextStatus,
    backend_origin: backendOrigin,
    checked_at: req.body?.checked_at || new Date().toISOString(),
    source: req.body?.source || 'backend_event'
  };

  io.emit('status_update', currentHealth);

  return res.status(200).json({ ok: true });
});

server.listen(statusPort, () => {
  console.log(`Status server running on http://localhost:${statusPort}`);
  console.log(`Waiting for backend events on http://localhost:${statusPort}/status/report`);
});
