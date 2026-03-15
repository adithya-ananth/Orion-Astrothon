/**
 * Alert configuration and status routes.
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const solarWindService = require('../services/solarWindService');
const visibilityService = require('../services/visibilityService');
const noaaService = require('../services/noaaService');

// In-memory alert configurations
const alertConfigs = [];

// POST /api/alerts/configure
router.post('/configure', (req, res) => {
  try {
    const { lat, lon, threshold, email } = req.body;
    if (lat == null || lon == null) {
      return res.status(400).json({ status: 'error', message: 'lat and lon are required' });
    }

    const config = {
      id: crypto.randomUUID(),
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      threshold: threshold != null ? parseFloat(threshold) : 50,
      email: email || null,
      createdAt: new Date().toISOString(),
    };

    alertConfigs.push(config);
    res.status(201).json({ status: 'ok', data: config });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/alerts/active
router.get('/active', (req, res) => {
  try {
    const alerts = solarWindService.getAlerts();
    res.json({ status: 'ok', data: alerts });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/alerts/check?lat=X&lon=Y
router.get('/check', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ status: 'error', message: 'lat and lon query params required' });
    }

    const solarAlerts = solarWindService.getAlerts();
    const cache = noaaService.getCache();

    // Check aurora probability at location
    const probability = visibilityService.getAuroraProbability(lat, lon, cache.ovation.data);
    const locationAlerts = [...solarAlerts];

    if (probability > 50) {
      locationAlerts.push({
        type: 'AURORA_LIKELY',
        message: `Aurora probability at your location is ${probability}%`,
        severity: probability > 80 ? 'critical' : 'warning',
        value: probability,
      });
    }

    res.json({
      status: 'ok',
      data: {
        lat,
        lon,
        probability,
        alerts: locationAlerts,
        shouldNotify: locationAlerts.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
