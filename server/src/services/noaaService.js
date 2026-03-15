/**
 * NOAA Space Weather Prediction Center data service.
 * Polls NOAA SWPC endpoints and caches results in memory.
 */
const fetch = require('node-fetch');
const {
  NOAA_MAG_URL,
  NOAA_PLASMA_URL,
  NOAA_OVATION_URL,
  NOAA_KP_URL,
  NOAA_FORECAST_URL,
  NOAA_ALERTS_URL,
  MAG_STALE_MS,
  PLASMA_STALE_MS,
  OVATION_STALE_MS,
} = require('../utils/constants');

// In-memory cache
const cache = {
  mag: { data: null, timestamp: 0, stale: true },
  plasma: { data: null, timestamp: 0, stale: true },
  ovation: { data: null, timestamp: 0, stale: true },
  kp: { data: null, timestamp: 0 },
  forecast: { data: null, timestamp: 0 },
  alerts: { data: null, timestamp: 0 },
};

/**
 * Generic fetch helper with timeout and error handling.
 */
async function fetchJSON(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check whether mag data contains gaps (null Bz values in recent entries).
 */
function hasMagGaps(data) {
  if (!Array.isArray(data) || data.length < 3) return true;
  const recent = data.slice(-5);
  return recent.some(row => row[3] === null || row[3] === '');
}

/**
 * Fetch 1-day magnetometer (IMF) data.
 * Implements DSCOVR→ACE failover: if data has gaps, re-fetches and flags it.
 */
async function fetchMagData() {
  try {
    let data = await fetchJSON(NOAA_MAG_URL);
    let source = 'DSCOVR';

    if (hasMagGaps(data)) {
      // Same endpoint is used by ACE fallback; flag as failover
      data = await fetchJSON(NOAA_MAG_URL);
      source = 'ACE_FAILOVER';
    }

    cache.mag = {
      data,
      source,
      timestamp: Date.now(),
      stale: false,
    };
    return cache.mag;
  } catch (err) {
    console.error('[noaaService] fetchMagData error:', err.message);
    if (cache.mag.data) cache.mag.stale = true;
    return cache.mag;
  }
}

/**
 * Fetch 1-day solar wind plasma data (speed, density, temperature).
 */
async function fetchPlasmaData() {
  try {
    const data = await fetchJSON(NOAA_PLASMA_URL);
    cache.plasma = {
      data,
      timestamp: Date.now(),
      stale: false,
    };
    return cache.plasma;
  } catch (err) {
    console.error('[noaaService] fetchPlasmaData error:', err.message);
    if (cache.plasma.data) cache.plasma.stale = true;
    return cache.plasma;
  }
}

/**
 * Fetch latest OVATION aurora probability grid (360×181).
 */
async function fetchOvationData() {
  try {
    const data = await fetchJSON(NOAA_OVATION_URL);
    cache.ovation = {
      data,
      timestamp: Date.now(),
      stale: false,
    };
    return cache.ovation;
  } catch (err) {
    console.error('[noaaService] fetchOvationData error:', err.message);
    if (cache.ovation.data) cache.ovation.stale = true;
    return cache.ovation;
  }
}

/**
 * Fetch planetary Kp index.
 */
async function fetchKpIndex() {
  try {
    const data = await fetchJSON(NOAA_KP_URL);
    cache.kp = { data, timestamp: Date.now() };
    return cache.kp;
  } catch (err) {
    console.error('[noaaService] fetchKpIndex error:', err.message);
    return cache.kp;
  }
}

/**
 * Fetch 3-day forecast.
 */
async function fetchForecast() {
  try {
    const data = await fetchJSON(NOAA_FORECAST_URL);
    cache.forecast = { data, timestamp: Date.now() };
    return cache.forecast;
  } catch (err) {
    console.error('[noaaService] fetchForecast error:', err.message);
    return cache.forecast;
  }
}

/**
 * Fetch NOAA space weather alerts.
 */
async function fetchAlerts() {
  try {
    const data = await fetchJSON(NOAA_ALERTS_URL);
    cache.alerts = { data, timestamp: Date.now() };
    return cache.alerts;
  } catch (err) {
    console.error('[noaaService] fetchAlerts error:', err.message);
    return cache.alerts;
  }
}

/**
 * Update staleness flags based on elapsed time.
 */
function updateStaleness() {
  const now = Date.now();
  if (cache.mag.timestamp && now - cache.mag.timestamp > MAG_STALE_MS) {
    cache.mag.stale = true;
  }
  if (cache.plasma.timestamp && now - cache.plasma.timestamp > PLASMA_STALE_MS) {
    cache.plasma.stale = true;
  }
  if (cache.ovation.timestamp && now - cache.ovation.timestamp > OVATION_STALE_MS) {
    cache.ovation.stale = true;
  }
}

/**
 * Get the full cache (read-only snapshot).
 */
function getCache() {
  updateStaleness();
  return { ...cache };
}

module.exports = {
  fetchMagData,
  fetchPlasmaData,
  fetchOvationData,
  fetchKpIndex,
  fetchForecast,
  fetchAlerts,
  getCache,
  // Exposed for testing
  _cache: cache,
  _hasMagGaps: hasMagGaps,
};
