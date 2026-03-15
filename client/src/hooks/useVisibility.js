import { useState, useEffect, useRef } from 'react';
import { fetchVisibility } from '../utils/api';

export default function useVisibility(lat, lon) {
  const [data, setData] = useState({ score: null, breakdown: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevKey = useRef('');

  useEffect(() => {
    if (lat == null || lon == null) return;

    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    let cancelled = false;
    setLoading(true);

    fetchVisibility(lat, lon)
      .then((result) => {
        if (cancelled) return;
        setData({
          score: result.composite ?? result.composite_score ?? result.score ?? null,
          breakdown: result.breakdown ?? null,
          bestTime: result.best_viewing_time ?? null,
          photography: result.photography ?? null,
        });
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return { ...data, loading, error };
}
