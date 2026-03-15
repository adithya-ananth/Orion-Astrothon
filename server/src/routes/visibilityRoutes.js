/**
 * Visibility score routes.
 */
const express = require('express');
const router = express.Router();
const noaaService = require('../services/noaaService');
const weatherService = require('../services/weatherService');
const visibilityService = require('../services/visibilityService');

// GET /api/visibility/score?lat=X&lon=Y
router.get('/score', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ status: 'error', message: 'lat and lon query params required' });
    }

    const cache = noaaService.getCache();
    const cloudData = await weatherService.fetchCloudCover(lat, lon);
    const darknessScore = visibilityService.getDarknessScore(lat, lon, new Date());

    const result = visibilityService.computeVisibilityScore(
      lat, lon,
      cache.ovation.data,
      cloudData,
      darknessScore
    );

    res.json({ status: 'ok', data: { lat, lon, ...result } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/visibility/magnetic-midnight?lat=X&lon=Y
router.get('/magnetic-midnight', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ status: 'error', message: 'lat and lon query params required' });
    }

    const result = visibilityService.getMagneticMidnight(lat, lon, new Date());
    res.json({ status: 'ok', data: { lat, lon, ...result } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
