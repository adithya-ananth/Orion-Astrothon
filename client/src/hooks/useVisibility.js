import { useState, useEffect } from 'react';
import { fetchVisibility } from '../utils/api';

export default function useVisibility(lat, lon) {
  const [data, setData] = useState({ score: null, breakdown: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Round coordinates to reduce sensitivity (prevent re-fetching on small GPS jitters)
  // 2 decimal places is ~1.1km precision
  const latKey = lat != null ? lat.toFixed(2) : null;
  const lonKey = lon != null ? lon.toFixed(2) : null;

  useEffect(() => {
    if (latKey === null || lonKey === null) {
      console.log('[useVisibility] Skipping fetch: lat/lon not available');
      return;
    }

    let cancelled = false;
    setLoading(true);
    console.log('[useVisibility] Fetching visibility for', { lat, lon });

    fetchVisibility(lat, lon)
      .then((result) => {
        if (cancelled) {
          console.log('[useVisibility] Request cancelled, ignoring result');
          return;
        }
        
        // Debug logging
        console.log('[useVisibility] API Result:', result);

        // Handle possible nesting if api.js didn't unwrap it, or if backend structure changed
        const dataPayload = result.data || result; 

        // Handle backend error responses
        if (result.status === 'error' || dataPayload.status === 'error') {
          const msg = result.message || dataPayload.message || 'Backend error';
          console.warn('[useVisibility] Backend returned error:', msg);
          setError(msg);
          setLoading(false);
          return;
        }

        const parsed = {
          score: dataPayload.composite ?? dataPayload.composite_score ?? dataPayload.score ?? null,
          breakdown: dataPayload.breakdown ?? null,
          bestTime: dataPayload.best_viewing_time ?? null,
          photography: dataPayload.photography ?? null,
        };
        
        console.log('[useVisibility] Parsed payload:', parsed);
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
  }, [latKey, lonKey]); // Keyed dependencies prevent jitter updates

  return { ...data, loading, error };
}
