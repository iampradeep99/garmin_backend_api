const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const statusPort = parseInt(process.env.STATUS_PORT || '3005', 10);
const targetHealthUrl = process.env.STATUS_TARGET_URL || 'http://localhost:3001/health';
const targetOrigin = new URL(targetHealthUrl).origin;
const publicPath = path.join(process.cwd(), 'public', 'status');

app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/status/health', async (req, res) => {
  try {
    const response = await axios.get(targetHealthUrl, {
      timeout: 4000,
      validateStatus: () => true
    });

    const payload = typeof response.data === 'object' && response.data !== null ? response.data : {};
    const status = payload.status || (response.status >= 200 && response.status < 300 ? 'online' : 'offline');

    return res.status(response.status).json({
      ok: response.status >= 200 && response.status < 300,
      status,
      backend_origin: targetOrigin,
      checked_at: new Date().toISOString(),
      backend: payload
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      status: 'offline',
      backend_origin: targetOrigin,
      checked_at: new Date().toISOString(),
      error: error.message
    });
  }
});

app.listen(statusPort, () => {
  console.log(`Status server running on http://localhost:${statusPort}`);
  console.log(`Monitoring backend health at ${targetHealthUrl}`);
});
