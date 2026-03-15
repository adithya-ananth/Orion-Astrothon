/**
 * Forecast routes (Kp index and 3-day forecast).
 */
const express = require('express');
const router = express.Router();
const noaaService = require('../services/noaaService');

// GET /api/forecast/kp
router.get('/kp', (req, res) => {
  try {
    const cache = noaaService.getCache();
    res.json({
      status: 'ok',
      data: cache.kp.data,
      timestamp: cache.kp.timestamp,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/forecast/3day
router.get('/3day', (req, res) => {
  try {
    const cache = noaaService.getCache();
    res.json({
      status: 'ok',
      data: cache.forecast.data,
      timestamp: cache.forecast.timestamp,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
