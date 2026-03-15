/**
 * Solar wind API routes.
 */
const express = require('express');
const router = express.Router();
const solarWindService = require('../services/solarWindService');
const noaaService = require('../services/noaaService');

// GET /api/solar-wind/latest
router.get('/latest', (req, res) => {
  try {
    const conditions = solarWindService.getLatestConditions();
    res.json({ status: 'ok', data: conditions });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/solar-wind/history
router.get('/history', (req, res) => {
  try {
    const cache = noaaService.getCache();
    res.json({
      status: 'ok',
      data: {
        mag: cache.mag.data,
        plasma: cache.plasma.data,
        magTimestamp: cache.mag.timestamp,
        plasmaTimestamp: cache.plasma.timestamp,
        magStale: cache.mag.stale,
        plasmaStale: cache.plasma.stale,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/solar-wind/alerts
router.get('/alerts', (req, res) => {
  try {
    const alerts = solarWindService.getAlerts();
    res.json({ status: 'ok', data: alerts });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
