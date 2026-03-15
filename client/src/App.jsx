import React, { useEffect, useMemo } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import SolarWindDashboard from './components/SolarWindDashboard';
import AuroraMap from './components/AuroraMap';
import VisibilityPanel from './components/VisibilityPanel';
import AlertConfig from './components/AlertConfig';
import KpForecast from './components/KpForecast';
import StatusBar from './components/StatusBar';
import useLocation from './hooks/useLocation';
import useSolarWind from './hooks/useSolarWind';
import './styles/App.css';

function AlertMonitor() {
  const { alertConfig, setAlertsActive } = useAppContext();
  const sw = useSolarWind();

  useEffect(() => {
    const active = [];
    if (alertConfig.bzAlert && sw.bz != null && sw.bz < -7) {
      active.push('Bz below −7 nT');
    }
    if (alertConfig.speedAlert && sw.speed != null && sw.speed > 500) {
      active.push('Speed above 500 km/s');
    }
    setAlertsActive(active);
  }, [sw.bz, sw.speed, alertConfig, setAlertsActive]);

  return null;
}

function AppContent() {
  const { nightVision, alertsActive } = useAppContext();
  const { lat, lon, loading: locLoading } = useLocation();

  const alertClass = alertsActive.length > 0 ? 'alert-active' : '';

  const containerClass = useMemo(
    () =>
      ['app-container', nightVision ? 'night-vision' : '', alertClass]
        .filter(Boolean)
        .join(' '),
    [nightVision, alertClass]
  );

  if (locLoading) {
    return (
      <div
        className="app-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌌</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Acquiring location…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <SolarWindDashboard />
      <div className="app-main">
        <AuroraMap lat={lat} lon={lon} />
        <VisibilityPanel lat={lat} lon={lon} />
      </div>
      <AlertConfig />
      <KpForecast />
      <StatusBar />
      <AlertMonitor />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
