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
      // Expect array of { lat, lon, probability } or OVATION aurora format
      const coords = result.coordinates || result.data || result || [];
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
