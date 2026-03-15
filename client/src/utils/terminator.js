import SunCalc from 'suncalc';

/**
 * Calculate the day/night terminator as a GeoJSON polygon for Leaflet.
 * Returns a polygon covering the nighttime hemisphere.
 */
export function getTerminatorGeoJSON(date = new Date()) {
  const points = [];
  // Walk along longitudes to find the terminator line
  for (let lng = -180; lng <= 180; lng += 2) {
    const lat = getTerminatorLatitude(lng, date);
    points.push([lng, lat]);
  }

  // Determine which side is night by checking solar position at (0,0)
  const sunPos = SunCalc.getPosition(date, 0, 0);
  const sunIsNorth = sunPos.altitude <= 0;

  // Build the night polygon
  const nightPoly = [];
  const capLat = sunIsNorth ? 90 : -90;

  nightPoly.push([-180, capLat]);
  for (const [lng, lat] of points) {
    nightPoly.push([lng, lat]);
  }
  nightPoly.push([180, capLat]);
  nightPoly.push([-180, capLat]);

  return {
    type: 'Feature',
    properties: { name: 'night' },
    geometry: {
      type: 'Polygon',
      coordinates: [nightPoly.map(([lng, lat]) => [lng, lat])],
    },
  };
}

/**
 * For a given longitude, find the latitude where the sun altitude is ~0.
 * Uses binary search with SunCalc.
 */
function getTerminatorLatitude(lng, date) {
  let lo = -90;
  let hi = 90;

  // Ensure lo is in shadow and hi is in sunlight for binary search
  const posLo = SunCalc.getPosition(date, lo, lng);
  const posHi = SunCalc.getPosition(date, hi, lng);
  if (posLo.altitude > 0 && posHi.altitude <= 0) {
    // Swap so lo=shadow, hi=sunlight
    [lo, hi] = [hi, lo];
  }

  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const pos = SunCalc.getPosition(date, mid, lng);
    if (pos.altitude > 0) {
      hi = mid; // mid is sunlit, move hi down
    } else {
      lo = mid; // mid is dark, move lo up
    }
  }
  return (lo + hi) / 2;
}

/**
 * Calculate solar midnight (magnetic midnight approximation) for a location.
 * Returns a Date object for the next magnetic midnight.
 */
export function getMagneticMidnight(lat, lon, date = new Date()) {
  const times = SunCalc.getTimes(date, lat, lon);
  // Magnetic midnight ≈ solar midnight + correction for magnetic declination
  // Simplified: use nadir (solar midnight) as approximation
  let nadir = times.nadir;
  if (nadir < date) {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = SunCalc.getTimes(tomorrow, lat, lon);
    nadir = tomorrowTimes.nadir;
  }
  return nadir;
}
