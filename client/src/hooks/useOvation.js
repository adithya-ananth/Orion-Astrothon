import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchOvation } from '../utils/api';

/**
 * Normalize a single OVATION data point.
 * NOAA returns [Longitude, Latitude, Aurora] arrays;
 * some caches may store objects with named keys.
 */
function normalizePoint(pt) {
  if (Array.isArray(pt) && pt.length >= 3) {
    // NOAA format: [Longitude, Latitude, Aurora]
    const rawLon = parseFloat(pt[0]) || 0;
    return {
      lat: parseFloat(pt[1]) || 0,
      lon: rawLon > 180 ? rawLon - 360 : rawLon,
      probability: parseFloat(pt[2]) || 0,
    };
  }
  // Object format fallback
  const rawLon = parseFloat(pt.Longitude ?? pt.lon ?? pt.longitude ?? 0);
  return {
    lat: parseFloat(pt.Latitude ?? pt.lat ?? pt.latitude ?? 0),
    lon: rawLon > 180 ? rawLon - 360 : rawLon,
    probability: parseFloat(pt.Aurora ?? pt.aurora ?? pt.probability ?? 0),
  };
}

export default function useOvation(interval = 300000) {
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchOvation();
      const raw = result.coordinates || result || [];
      const coords = Array.isArray(raw) ? raw.map(normalizePoint) : [];
      setCoordinates(coords);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, interval);
    return () => clearInterval(timerRef.current);
  }, [load, interval]);

  return { coordinates, loading, error };
}
