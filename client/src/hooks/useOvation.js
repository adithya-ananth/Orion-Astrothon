import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchOvation } from '../utils/api';

export default function useOvation(interval = 300000) {
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchOvation();
      // Normalize OVATION data to consistent { lat, lon, probability } format
      const raw = result.coordinates || result || [];
      const coords = Array.isArray(raw) ? raw.map(pt => ({
        lat: parseFloat(pt.Latitude ?? pt.lat ?? pt.latitude ?? 0),
        lon: parseFloat(pt.Longitude ?? pt.lon ?? pt.longitude ?? 0),
        probability: parseFloat(pt.Aurora ?? pt.aurora ?? pt.probability ?? 0),
      })) : [];
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
