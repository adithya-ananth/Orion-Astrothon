import { useState, useEffect, useRef } from 'react';
import { fetchVisibility } from '../utils/api';

export default function useVisibility(lat, lon) {
  const [data, setData] = useState({ score: null, breakdown: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevKey = useRef('');

  useEffect(() => {
    if (lat == null || lon == null) {
      console.log('[useVisibility] Skipping fetch: lat/lon not available', { lat, lon });
      return;
    }

    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    let cancelled = false;
    setLoading(true);
    console.log('[useVisibility] Fetching visibility for', { lat, lon });

    fetchVisibility(lat, lon)
      .then((result) => {
        if (cancelled) return;
        console.log('[useVisibility] Raw API result:', JSON.stringify(result));

        // Handle backend error responses (HTTP 200 with status:"error")
        if (result && result.status === 'error') {
          console.warn('[useVisibility] Backend returned error:', result.message);
          setError(result.message || 'Backend error');
          setLoading(false);
          return;
        }

        const parsed = {
          score: result.composite ?? result.composite_score ?? result.score ?? null,
          breakdown: result.breakdown ?? null,
          bestTime: result.best_viewing_time ?? null,
          photography: result.photography ?? null,
        };
        console.log('[useVisibility] Parsed data:', JSON.stringify(parsed));
        setData(parsed);
        setError(null);
      })
      .catch((err) => {
        console.error('[useVisibility] Fetch error:', err.message);
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
