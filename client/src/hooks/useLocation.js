import { useState, useEffect, useCallback } from 'react';

export default function useLocation() {
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        // Fallback: Fairbanks, AK (great aurora viewing)
        setLocation({ lat: 64.8378, lon: -147.7164 });
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const setManualLocation = useCallback((lat, lon) => {
    setLocation({ lat, lon });
    setError(null);
  }, []);

  return { ...location, loading, error, setManualLocation };
}
