/**
 * Solar wind data processing service.
 * Computes derived quantities from raw NOAA solar wind data.
 */
const noaaService = require('./noaaService');
const {
  BZ_ALERT_THRESHOLD,
  SPEED_ALERT_THRESHOLD,
  SUBSTORM_DBZ_RATE,
  SUBSTORM_SUSTAINED_MIN,
  L1_DISTANCE_KM,
  BZ_HISTORY_MINUTES,
} = require('../utils/constants');

// Rolling 30-minute history of Bz values: { timestamp, bz }
const bzHistory = [];

/**
 * Trim Bz history to keep only the last BZ_HISTORY_MINUTES of data.
 */
function trimBzHistory() {
  const cutoff = Date.now() - BZ_HISTORY_MINUTES * 60 * 1000;
  while (bzHistory.length > 0 && bzHistory[0].timestamp < cutoff) {
    bzHistory.shift();
  }
}

/**
 * Push a new Bz reading into the rolling history.
 */
function recordBz(bz, timestamp) {
  if (bz === null || bz === undefined || isNaN(bz)) return;
  bzHistory.push({ timestamp: timestamp || Date.now(), bz: parseFloat(bz) });
  trimBzHistory();
}

/**
 * Get the latest solar wind conditions from cached NOAA data.
 */
function getLatestConditions() {
  const cache = noaaService.getCache();

  let bz = null, bx = null, by = null, bt = null;
  let speed = null, density = null, temperature = null;

  // Parse mag data (header row + data rows)
  if (cache.mag.data && Array.isArray(cache.mag.data) && cache.mag.data.length > 1) {
    const latest = cache.mag.data[cache.mag.data.length - 1];
    // Columns: time_tag, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt
    bx = parseFloat(latest[1]) || null;
    by = parseFloat(latest[2]) || null;
    bz = parseFloat(latest[3]) || null;
    bt = parseFloat(latest[6]) || null;

    if (bz !== null) recordBz(bz);
  }

  // Parse plasma data
  if (cache.plasma.data && Array.isArray(cache.plasma.data) && cache.plasma.data.length > 1) {
    const latest = cache.plasma.data[cache.plasma.data.length - 1];
    // Columns: time_tag, density, speed, temperature
    density = parseFloat(latest[1]) || null;
    speed = parseFloat(latest[2]) || null;
    temperature = parseFloat(latest[3]) || null;
  }

  const coupling = (bz !== null && by !== null && speed !== null)
    ? computeNewellCoupling(bz, by, speed)
    : null;

  const delay = speed ? computePropagationDelay(speed) : null;

  return {
    bz, bx, by, bt,
    speed, density, temperature,
    newellCoupling: coupling,
    propagationDelay: delay,
    magStale: cache.mag.stale,
    plasmaStale: cache.plasma.stale,
    magSource: cache.mag.source || null,
  };
}

/**
 * Newell coupling function:
 *   dΦ/dt = v^(4/3) * Bt^(2/3) * sin^(8/3)(θ/2)
 * where θ = atan2(By, Bz) is the IMF clock angle.
 */
function computeNewellCoupling(bz, by, speed) {
  const theta = Math.atan2(Math.abs(by), bz);
  // Bt = sqrt(by^2 + bz^2)
  const Bt = Math.sqrt(by * by + bz * bz);
  if (Bt === 0 || speed <= 0) return 0;

  const sinHalfTheta = Math.sin(Math.abs(theta) / 2);
  return Math.pow(speed, 4 / 3) * Math.pow(Bt, 2 / 3) * Math.pow(sinHalfTheta, 8 / 3);
}

/**
 * Propagation delay from L1 to Earth in seconds.
 * delay = L1_DISTANCE_KM / speed
 */
function computePropagationDelay(speed) {
  if (!speed || speed <= 0) return null;
  return L1_DISTANCE_KM / speed;
}

/**
 * Check Bz threshold alert.
 */
function checkBzThreshold(bz) {
  if (bz === null || bz === undefined) return null;
  if (bz < BZ_ALERT_THRESHOLD) {
    return {
      type: 'BZ_SOUTHWARD',
      message: `Bz is ${bz.toFixed(1)} nT (threshold: ${BZ_ALERT_THRESHOLD} nT)`,
      severity: bz < BZ_ALERT_THRESHOLD * 2 ? 'critical' : 'warning',
      value: bz,
    };
  }
  return null;
}

/**
 * Check solar wind speed threshold alert.
 */
function checkSpeedThreshold(speed) {
  if (speed === null || speed === undefined) return null;
  if (speed > SPEED_ALERT_THRESHOLD) {
    return {
      type: 'HIGH_SPEED',
      message: `Solar wind speed is ${speed.toFixed(0)} km/s (threshold: ${SPEED_ALERT_THRESHOLD} km/s)`,
      severity: speed > SPEED_ALERT_THRESHOLD * 1.5 ? 'critical' : 'warning',
      value: speed,
    };
  }
  return null;
}

/**
 * Detect substorm precursor from Bz history.
 * If dBz/dt > SUBSTORM_DBZ_RATE nT/min sustained for SUBSTORM_SUSTAINED_MIN minutes → alert.
 */
function detectSubstorm(history) {
  const bzData = history || bzHistory;
  if (bzData.length < 2) return null;

  // Compute dBz/dt for each consecutive pair (nT/min)
  const rates = [];
  for (let i = 1; i < bzData.length; i++) {
    const dtMin = (bzData[i].timestamp - bzData[i - 1].timestamp) / 60000;
    if (dtMin <= 0) continue;
    const dBz = Math.abs(bzData[i].bz - bzData[i - 1].bz);
    rates.push({ rate: dBz / dtMin, timestamp: bzData[i].timestamp });
  }

  // Check for sustained high rate
  const sustainedMs = SUBSTORM_SUSTAINED_MIN * 60 * 1000;
  let streakStart = null;

  for (const { rate, timestamp } of rates) {
    if (rate > SUBSTORM_DBZ_RATE) {
      if (!streakStart) streakStart = timestamp;
      if (timestamp - streakStart >= sustainedMs) {
        return {
          type: 'SUBSTORM_PRECURSOR',
          message: `dBz/dt > ${SUBSTORM_DBZ_RATE} nT/min sustained for ${SUBSTORM_SUSTAINED_MIN}+ minutes`,
          severity: 'warning',
          duration: (timestamp - streakStart) / 60000,
        };
      }
    } else {
      streakStart = null;
    }
  }

  return null;
}

/**
 * Get all current alerts.
 */
function getAlerts() {
  const conditions = getLatestConditions();
  const alerts = [];

  const bzAlert = checkBzThreshold(conditions.bz);
  if (bzAlert) alerts.push(bzAlert);

  const speedAlert = checkSpeedThreshold(conditions.speed);
  if (speedAlert) alerts.push(speedAlert);

  const substormAlert = detectSubstorm();
  if (substormAlert) alerts.push(substormAlert);

  return alerts;
}

module.exports = {
  getLatestConditions,
  computeNewellCoupling,
  computePropagationDelay,
  checkBzThreshold,
  checkSpeedThreshold,
  detectSubstorm,
  getAlerts,
  recordBz,
  // Exposed for testing
  _bzHistory: bzHistory,
};
