/**
 * Weather data service.
 * Fetches cloud cover from Open-Meteo API with caching.
 */
const fetch = require('node-fetch');
const { OPEN_METEO_BASE, WEATHER_CACHE_MS } = require('../utils/constants');

// Cache keyed by grid cell (0.5° resolution)
const weatherCache = new Map();

/**
 * Round coordinates to 0.5° grid cell.
 */
function gridKey(lat, lon) {
  const gLat = (Math.round(lat * 2) / 2).toFixed(1);
  const gLon = (Math.round(lon * 2) / 2).toFixed(1);
  return `${gLat},${gLon}`;
}

/**
 * Fetch cloud cover for a given latitude and longitude.
 * Returns { total, low, mid, high } cloud cover percentages.
 * Caches per 0.5° grid cell for 15 minutes.
 */
async function fetchCloudCover(lat, lon) {
  const key = gridKey(lat, lon);
  const now = Date.now();

  // Check cache
  if (weatherCache.has(key)) {
    const cached = weatherCache.get(key);
    if (now - cached.timestamp < WEATHER_CACHE_MS) {
      return cached.data;
    }
  }

  try {
    const url = `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high`;
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error(`HTTP ${res.status} from Open-Meteo`);

    const json = await res.json();
    const current = json.current || {};

    const data = {
      total: current.cloud_cover != null ? current.cloud_cover : null,
      low: current.cloud_cover_low != null ? current.cloud_cover_low : null,
      mid: current.cloud_cover_mid != null ? current.cloud_cover_mid : null,
      high: current.cloud_cover_high != null ? current.cloud_cover_high : null,
    };

    weatherCache.set(key, { data, timestamp: now });
    return data;
  } catch (err) {
    console.error('[weatherService] fetchCloudCover error:', err.message);
    // Return cached data if available (even if stale)
    if (weatherCache.has(key)) {
      return weatherCache.get(key).data;
    }
    return { total: null, low: null, mid: null, high: null };
  }
}

/**
 * Clear the weather cache (for testing).
 */
function clearCache() {
  weatherCache.clear();
}

module.exports = {
  fetchCloudCover,
  clearCache,
  _gridKey: gridKey,
  _weatherCache: weatherCache,
};
