/**
 * Photography settings recommendation routes.
 */
const express = require('express');
const router = express.Router();

/**
 * Get recommended camera settings based on Kp index.
 */
function getRecommendedSettings(kp) {
  let iso, aperture, shutterSpeed, colorPrediction;

  if (kp >= 7) {
    iso = 800;
    aperture = 'f/2.8';
    shutterSpeed = '8s';
    colorPrediction = 'Vivid greens with red/purple tops likely; fast-moving curtains';
  } else if (kp >= 5) {
    iso = 1600;
    aperture = 'f/2.8';
    shutterSpeed = '10s';
    colorPrediction = 'Strong green dominant with possible red tops above Kp6';
  } else if (kp >= 3) {
    iso = 3200;
    aperture = 'f/2.8';
    shutterSpeed = '15s';
    colorPrediction = 'Green dominant, subtle glow; longer exposures needed';
  } else {
    iso = 6400;
    aperture = 'f/2.0';
    shutterSpeed = '20s';
    colorPrediction = 'Faint or sub-visual aurora; may only appear in long exposure photos';
  }

  return {
    kp,
    iso,
    aperture,
    shutterSpeed,
    colorPrediction,
    tips: [
      'Use a sturdy tripod',
      'Manual focus set to infinity',
      'Shoot RAW for best post-processing',
      'Use a 2-second timer or remote shutter',
      kp >= 5 ? 'Fast-moving aurora — reduce exposure time' : 'Slow aurora — longer exposures are fine',
    ],
  };
}

// GET /api/photography/settings?kp=X
router.get('/settings', (req, res) => {
  try {
    const kp = parseFloat(req.query.kp);
    if (isNaN(kp) || kp < 0 || kp > 9) {
      return res.status(400).json({
        status: 'error',
        message: 'kp query param required (0-9)',
      });
    }

    const settings = getRecommendedSettings(kp);
    res.json({ status: 'ok', data: settings });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
