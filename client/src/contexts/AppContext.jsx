import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

const DEFAULT_ALERTS = {
  scoreThreshold: 60,
  bzAlert: true,
  substormAlert: true,
  speedAlert: true,
};

function loadAlerts() {
  try {
    const stored = localStorage.getItem('aurora_alerts');
    return stored ? { ...DEFAULT_ALERTS, ...JSON.parse(stored) } : DEFAULT_ALERTS;
  } catch {
    return DEFAULT_ALERTS;
  }
}

export function AppProvider({ children }) {
  const [nightVision, setNightVision] = useState(false);
  const [alertConfig, setAlertConfigState] = useState(loadAlerts);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [alertsActive, setAlertsActive] = useState([]);

  const toggleNightVision = useCallback(() => setNightVision((v) => !v), []);

  const setAlertConfig = useCallback((cfg) => {
    setAlertConfigState((prev) => {
      const next = typeof cfg === 'function' ? cfg(prev) : { ...prev, ...cfg };
      localStorage.setItem('aurora_alerts', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = {
    nightVision,
    toggleNightVision,
    alertConfig,
    setAlertConfig,
    selectedPoint,
    setSelectedPoint,
    alertsActive,
    setAlertsActive,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
