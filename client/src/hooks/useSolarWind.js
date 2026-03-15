import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSolarWind } from '../utils/api';

export default function useSolarWind(interval = 60000) {
  const [data, setData] = useState({
    bz: null,
    speed: null,
    density: null,
    temp: null,
    coupling: null,
    delay: null,
    source: null,
    timestamp: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchSolarWind();
      setData({
        bz: result.bz ?? null,
        speed: result.speed ?? null,
        density: result.density ?? null,
        temp: result.temperature ?? null,
        coupling: result.newellCoupling ?? result.coupling ?? null,
        delay: result.propagationDelay ?? result.propagation_delay ?? null,
        source: result.magSource ?? result.source ?? 'DSCOVR',
        timestamp: result.timestamp ?? new Date().toISOString(),
      });
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

  return { ...data, loading, error };
}
