/**
 * Visibility scoring service.
 * Computes composite visibility scores for aurora observation.
 */
const { solarPosition, lunarPosition, lunarPhase, isAstronomicalTwilight } = require('../utils/astronomy');
const { AURORA_WEIGHT, CLOUD_WEIGHT, DARKNESS_WEIGHT, OVATION_LON_BINS, OVATION_LAT_BINS } = require('../utils/constants');

/**
 * Compute the composite visibility score (0-100).
 * Weights: aurora 50%, cloud cover 35%, darkness 15%.
 */
function computeVisibilityScore(lat, lon, ovationData, cloudData, darknessData) {
  const aurora = getAuroraProbability(lat, lon, ovationData);
  const cloud = getCloudScore(cloudData);
  const darkness = darknessData != null ? darknessData : getDarknessScore(lat, lon, new Date());

  const score = aurora * AURORA_WEIGHT + cloud * CLOUD_WEIGHT + darkness * DARKNESS_WEIGHT;
  return {
    composite: Math.round(Math.max(0, Math.min(100, score))),
    breakdown: {
      aurora: Math.round(aurora),
      cloud: Math.round(cloud),
      darkness: Math.round(darkness),
    },
    weights: {
      aurora: AURORA_WEIGHT,
      cloud: CLOUD_WEIGHT,
      darkness: DARKNESS_WEIGHT,
    },
  };
}

/**
 * Interpolate aurora probability from OVATION grid data.
 * OVATION data is an array of { Longitude, Latitude, Aurora } objects.
 */
function getAuroraProbability(lat, lon, ovationData) {
  if (!ovationData) return 0;

  // Find the coordinates array (may be nested under a key)
  let coords = ovationData;
  if (ovationData.coordinates) {
    coords = ovationData.coordinates;
  }

  if (!Array.isArray(coords) || coords.length === 0) return 0;

  // Normalize longitude to [0, 360)
  const normLon = ((lon % 360) + 360) % 360;

  // Find nearest grid points
  let minDist = Infinity;
  let nearest = 0;

  for (const point of coords) {
    if (!point || point.Aurora === undefined) continue;
    const pLat = parseFloat(point.Latitude || point.lat);
    const pLon = parseFloat(point.Longitude || point.lon);
    if (isNaN(pLat) || isNaN(pLon)) continue;

    const dLat = pLat - lat;
    const dLon = pLon - normLon;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = parseFloat(point.Aurora || 0);
    }
  }

  // Scale: OVATION aurora values are typically 0-100
  return Math.max(0, Math.min(100, nearest));
}

/**
 * Compute cloud cover score.
 * Low stratus weighted 2x vs high cirrus.
 * Score = 100 - weighted cloud percentage.
 */
function getCloudScore(cloudData) {
  if (!cloudData) return 50; // assume moderate if no data

  const low = cloudData.low || 0;    // stratus - worst for visibility
  const mid = cloudData.mid || 0;
  const high = cloudData.high || 0;  // cirrus - less impactful
  const total = cloudData.total;

  if (total !== undefined && total !== null) {
    // Weighted: low clouds weighted 2x
    const weightedPct = (low * 2 + mid * 1.5 + high * 0.5) / 4;
    return Math.max(0, Math.min(100, 100 - weightedPct));
  }

  const weightedPct = (low * 2 + mid * 1.5 + high * 0.5) / 4;
  return Math.max(0, Math.min(100, 100 - weightedPct));
}

/**
 * Compute darkness score (0-100).
 * Combines sun altitude, moon altitude × phase, and approximate Bortle class.
 */
function getDarknessScore(lat, lon, timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const sun = solarPosition(lat, lon, date);
  const moon = lunarPosition(lat, lon, date);
  const moonIllum = lunarPhase(date);

  let score = 0;

  // Sun contribution (must be below horizon, best > 18° below)
  if (sun.altitude < -18) {
    score += 60; // astronomical twilight - full dark
  } else if (sun.altitude < -12) {
    score += 40; // nautical twilight
  } else if (sun.altitude < -6) {
    score += 20; // civil twilight
  } else if (sun.altitude < 0) {
    score += 5;  // sun just below horizon
  }
  // sun above horizon → 0

  // Moon contribution (bright moon hurts)
  const moonPenalty = (moon.altitude > 0) ? moonIllum * 30 : 0;
  score -= moonPenalty;

  // Bortle class estimate: assume rural (Bortle 4) baseline = 10 bonus
  score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get sun altitude at a location and time.
 */
function getSunAltitude(lat, lon, timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return solarPosition(lat, lon, date);
}

/**
 * Get moon illumination at a given time.
 */
function getMoonIllumination(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return lunarPhase(date);
}

/**
 * Estimate when magnetic midnight occurs for a given location.
 * Magnetic midnight ≈ solar midnight + offset based on magnetic declination.
 * Simplified: magnetic midnight ≈ 00:00 MLT, offset by geomagnetic longitude.
 */
function getMagneticMidnight(lat, lon, timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  // Approximate geomagnetic coordinates (IGRF dipole approximation)
  // Geomagnetic north pole: ~80.5°N, 287.4°E (72.6°W)
  const geomagPoleLat = 80.5;
  const geomagPoleLon = -72.6;

  // Geomagnetic longitude offset
  const dLon = lon - geomagPoleLon;
  // Magnetic midnight: when location's magnetic local time = 00:00
  // MLT offset = dLon / 15 hours from geographic midnight
  const mltOffsetHours = dLon / 15;

  // Solar midnight at the location
  const solarMidnightUTC = 24 - (lon / 15);
  // Magnetic midnight = solar midnight - MLT offset
  let magMidnightUTC = (solarMidnightUTC - mltOffsetHours + 24) % 24;

  // Build the date for magnetic midnight
  const result = new Date(date);
  result.setUTCHours(Math.floor(magMidnightUTC), Math.round((magMidnightUTC % 1) * 60), 0, 0);

  return {
    magneticMidnightUTC: magMidnightUTC,
    timestamp: result.toISOString(),
    note: 'Approximate magnetic midnight based on dipole geomagnetic model',
  };
}

module.exports = {
  computeVisibilityScore,
  getAuroraProbability,
  getCloudScore,
  getDarknessScore,
  getSunAltitude,
  getMoonIllumination,
  getMagneticMidnight,
};
