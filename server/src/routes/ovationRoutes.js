/**
 * OVATION aurora map data routes.
 */
const express = require('express');
const router = express.Router();
const noaaService = require('../services/noaaService');
const visibilityService = require('../services/visibilityService');

// GET /api/ovation/latest
router.get('/latest', (req, res) => {
  try {
    const cache = noaaService.getCache();
    res.json({
      status: 'ok',
      data: cache.ovation.data,
      timestamp: cache.ovation.timestamp,
      stale: cache.ovation.stale,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/ovation/probability?lat=X&lon=Y
router.get('/probability', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ status: 'error', message: 'lat and lon query params required' });
    }

    const cache = noaaService.getCache();
    const ovationData = cache.ovation.data;

    if (!ovationData) {
      return res.status(503).json({ status: 'error', message: 'OVATION data not yet available' });
    }

    const probability = visibilityService.getAuroraProbability(lat, lon, ovationData);
    res.json({
      status: 'ok',
      data: { lat, lon, probability },
      timestamp: cache.ovation.timestamp,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
