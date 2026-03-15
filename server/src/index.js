/**
 * Hyper-Local Aurora Forecasting Platform - Main Server
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cron = require('node-cron');

const noaaService = require('./services/noaaService');

// Route imports
const solarWindRoutes = require('./routes/solarWindRoutes');
const ovationRoutes = require('./routes/ovationRoutes');
const visibilityRoutes = require('./routes/visibilityRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const alertRoutes = require('./routes/alertRoutes');
const photographyRoutes = require('./routes/photographyRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const SHUTDOWN_TIMEOUT_MS = 10000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(compression());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  const cache = noaaService.getCache();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dataStatus: {
      mag: { fresh: !cache.mag.stale, lastUpdate: cache.mag.timestamp || null },
      plasma: { fresh: !cache.plasma.stale, lastUpdate: cache.plasma.timestamp || null },
      ovation: { fresh: !cache.ovation.stale, lastUpdate: cache.ovation.timestamp || null },
      kp: { lastUpdate: cache.kp.timestamp || null },
      forecast: { lastUpdate: cache.forecast.timestamp || null },
    },
  });
});

// Mount routes
app.use('/api/solar-wind', solarWindRoutes);
app.use('/api/ovation', ovationRoutes);
app.use('/api/visibility', visibilityRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/photography', photographyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

// Scheduled data polling with node-cron
let cronJobs = [];
let magPlasmaFetching = false;

function startCronJobs() {
  // Every 1 minute: mag + plasma data (with overlap guard)
  cronJobs.push(cron.schedule('* * * * *', async () => {
    if (magPlasmaFetching) return;
    magPlasmaFetching = true;
    try {
      await Promise.all([
        noaaService.fetchMagData(),
        noaaService.fetchPlasmaData(),
      ]);
    } catch (err) {
      console.error('[cron] mag/plasma fetch error:', err.message);
    } finally {
      magPlasmaFetching = false;
    }
  }));

  // Every 5 minutes: OVATION data
  cronJobs.push(cron.schedule('*/5 * * * *', async () => {
    try {
      await noaaService.fetchOvationData();
    } catch (err) {
      console.error('[cron] OVATION fetch error:', err.message);
    }
  }));

  // Every 30 minutes: Kp, forecast, alerts
  cronJobs.push(cron.schedule('*/30 * * * *', async () => {
    try {
      await Promise.all([
        noaaService.fetchKpIndex(),
        noaaService.fetchForecast(),
        noaaService.fetchAlerts(),
      ]);
    } catch (err) {
      console.error('[cron] Kp/forecast/alerts fetch error:', err.message);
    }
  }));
}

// Start server
let server;

function start() {
  server = app.listen(PORT, () => {
    console.log(`[server] Aurora Forecast API running on port ${PORT}`);
  });

  startCronJobs();

  // Initial data fetch on startup
  console.log('[server] Performing initial data fetch...');
  Promise.all([
    noaaService.fetchMagData(),
    noaaService.fetchPlasmaData(),
    noaaService.fetchOvationData(),
    noaaService.fetchKpIndex(),
    noaaService.fetchForecast(),
    noaaService.fetchAlerts(),
  ]).then(() => {
    console.log('[server] Initial data fetch complete');
  }).catch((err) => {
    console.error('[server] Initial data fetch error:', err.message);
  });

  return server;
}

// Graceful shutdown
function shutdown() {
  console.log('[server] Shutting down gracefully...');
  cronJobs.forEach(job => job.stop());
  cronJobs = [];
  if (server) {
    server.close(() => {
      console.log('[server] HTTP server closed');
      process.exit(0);
    });
    // Force exit after timeout
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Only start if run directly (not imported for testing)
if (require.main === module) {
  start();
}

module.exports = { app, start, shutdown };
