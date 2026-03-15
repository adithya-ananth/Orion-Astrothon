/**
 * Pure astronomical math functions.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * Julian Date from a JS Date object.
 */
function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Julian centuries since J2000.0.
 */
function julianCenturies(date) {
  const jd = toJulianDate(date);
  return (jd - 2451545.0) / 36525.0;
}

/**
 * Normalize angle to [0, 360).
 */
function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Solar position (altitude, azimuth) for a given latitude, longitude, and date.
 * Uses simplified astronomical formulas.
 */
function solarPosition(lat, lon, date) {
  const T = julianCenturies(date);

  // Mean longitude of the sun (degrees)
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  // Mean anomaly (degrees)
  const M = normalizeDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = M * DEG;

  // Equation of center
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // Sun's true longitude and anomaly
  const sunLon = L0 + C;

  // Obliquity of the ecliptic
  const obliquity = 23.439291 - 0.0130042 * T;
  const oblRad = obliquity * DEG;
  const sunLonRad = sunLon * DEG;

  // Right ascension and declination
  const sinDec = Math.sin(oblRad) * Math.sin(sunLonRad);
  const declination = Math.asin(sinDec) * RAD;
  const ra = Math.atan2(
    Math.cos(oblRad) * Math.sin(sunLonRad),
    Math.cos(sunLonRad)
  ) * RAD;

  // Greenwich Mean Sidereal Time
  const jd = toJulianDate(date);
  const D = jd - 2451545.0;
  const GMST = normalizeDeg(280.46061837 + 360.98564736629 * D);
  const LST = normalizeDeg(GMST + lon);

  // Hour angle
  const HA = (LST - normalizeDeg(ra)) * DEG;

  const latRad = lat * DEG;
  const decRad = declination * DEG;

  // Altitude
  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(HA);
  const altitude = Math.asin(sinAlt) * RAD;

  // Azimuth
  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD;
  if (Math.sin(HA) > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

/**
 * Approximate lunar position.
 */
function lunarPosition(lat, lon, date) {
  const T = julianCenturies(date);

  // Simplified lunar coordinates
  const Lm = normalizeDeg(218.3165 + 481267.8813 * T); // mean longitude
  const D = normalizeDeg(297.8502 + 445267.1115 * T);   // mean elongation
  const M = normalizeDeg(357.5291 + 35999.0503 * T);    // sun mean anomaly
  const Mm = normalizeDeg(134.9634 + 477198.8676 * T);  // moon mean anomaly
  const F = normalizeDeg(93.2720 + 483202.0175 * T);    // argument of latitude

  // Ecliptic longitude (simplified)
  const moonLon = Lm +
    6.289 * Math.sin(Mm * DEG) +
    1.274 * Math.sin((2 * D - Mm) * DEG) +
    0.658 * Math.sin(2 * D * DEG) +
    0.214 * Math.sin(2 * Mm * DEG) -
    0.186 * Math.sin(M * DEG);

  // Ecliptic latitude (simplified)
  const moonLat =
    5.128 * Math.sin(F * DEG) +
    0.281 * Math.sin((Mm + F) * DEG) +
    0.278 * Math.sin((Mm - F) * DEG);

  // Convert ecliptic to equatorial
  const obliquity = 23.439291 - 0.0130042 * T;
  const oblRad = obliquity * DEG;
  const lonRad = moonLon * DEG;
  const latEcl = moonLat * DEG;

  const sinDec =
    Math.sin(latEcl) * Math.cos(oblRad) +
    Math.cos(latEcl) * Math.sin(oblRad) * Math.sin(lonRad);
  const declination = Math.asin(sinDec) * RAD;
  const ra = Math.atan2(
    Math.cos(latEcl) * Math.sin(oblRad) * Math.cos(lonRad) +
      Math.sin(latEcl) * Math.sin(oblRad),
    Math.cos(latEcl) * Math.cos(lonRad)
  );

  // Hour angle
  const jd = toJulianDate(date);
  const Dd = jd - 2451545.0;
  const GMST = normalizeDeg(280.46061837 + 360.98564736629 * Dd);
  const LST = normalizeDeg(GMST + lon);
  const HA = (LST - normalizeDeg(ra * RAD)) * DEG;

  const latRad = lat * DEG;
  const decRad = declination * DEG;

  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(HA);
  const altitude = Math.asin(sinAlt) * RAD;

  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD;
  if (Math.sin(HA) > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

/**
 * Lunar phase: returns illumination fraction 0-1.
 */
function lunarPhase(date) {
  // Synodic month = 29.53059 days
  // Known new moon: Jan 6, 2000 18:14 UTC
  const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const synodicMonth = 29.53059;
  const daysSinceNew = (date.getTime() - knownNewMoon.getTime()) / 86400000;
  const phase = ((daysSinceNew % synodicMonth) + synodicMonth) % synodicMonth;
  // Illumination fraction using cosine approximation
  return (1 - Math.cos((phase / synodicMonth) * 2 * Math.PI)) / 2;
}

/**
 * Returns true if the sun is more than 18° below the horizon (astronomical twilight / true dark).
 */
function isAstronomicalTwilight(lat, lon, date) {
  const { altitude } = solarPosition(lat, lon, date);
  return altitude < -18;
}

/**
 * Compute day/night terminator line as an array of {lat, lon} points.
 */
function dayNightTerminator(date) {
  const T = julianCenturies(date);
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T);
  const M = normalizeDeg(357.52911 + 35999.05029 * T);
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(M * DEG) +
    0.019993 * Math.sin(2 * M * DEG);
  const sunLon = (L0 + C) * DEG;
  const obliquity = (23.439291 - 0.0130042 * T) * DEG;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(sunLon));

  const jd = toJulianDate(date);
  const D = jd - 2451545.0;
  const GMST = normalizeDeg(280.46061837 + 360.98564736629 * D);

  const points = [];
  for (let lonDeg = -180; lonDeg <= 180; lonDeg += 2) {
    const HA = (normalizeDeg(GMST + lonDeg) - normalizeDeg(0)) * DEG;
    // At terminator, altitude = 0 → sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(HA) = 0
    // tan(lat) = -cos(HA)*cos(dec)/sin(dec) = -cos(HA)/tan(dec)
    const tanLat = -Math.cos(HA + lonDeg * DEG) / Math.tan(declination);
    const latDeg = Math.atan(tanLat) * RAD;
    if (latDeg >= -90 && latDeg <= 90) {
      points.push({ lat: latDeg, lon: lonDeg });
    }
  }
  return points;
}

module.exports = {
  solarPosition,
  lunarPosition,
  lunarPhase,
  isAstronomicalTwilight,
  dayNightTerminator,
  toJulianDate,
  julianCenturies,
  normalizeDeg,
};
