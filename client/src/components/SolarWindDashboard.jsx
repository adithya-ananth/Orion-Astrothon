import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import useSolarWind from '../hooks/useSolarWind';
import { bzColor, speedColor, kpColor, freshnessColor } from '../utils/colors';
import '../styles/Dashboard.css';

function Widget({ label, value, unit, color, loading }) {
  return (
    <div className="widget">
      <span className="widget-label">{label}</span>
      {loading || value == null ? (
        <div className="skeleton widget-skeleton" />
      ) : (
        <>
          <span className="widget-value" style={{ color }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          {unit && <span className="widget-unit">{unit}</span>}
        </>
      )}
    </div>
  );
}

export default function SolarWindDashboard() {
  const { nightVision, toggleNightVision } = useAppContext();
  const sw = useSolarWind();

  const secondsAgo = sw.timestamp
    ? Math.floor((Date.now() - new Date(sw.timestamp).getTime()) / 1000)
    : Infinity;

  return (
    <div className="dashboard-bar">
      <div className="dashboard-brand">
        <span className="brand-icon">🌌</span>
        <h1>Aurora Forecast</h1>
      </div>

      <Widget
        label="Bz"
        value={sw.bz}
        unit="nT"
        color={sw.bz != null ? bzColor(sw.bz) : undefined}
        loading={sw.loading}
      />
      <Widget
        label="Speed"
        value={sw.speed}
        unit="km/s"
        color={sw.speed != null ? speedColor(sw.speed) : undefined}
        loading={sw.loading}
      />
      <Widget
        label="Kp"
        value={sw.coupling != null ? '—' : '—'}
        unit=""
        color={undefined}
        loading={sw.loading}
      />
      <Widget
        label="Density"
        value={sw.density}
        unit="p/cm³"
        loading={sw.loading}
      />
      <Widget
        label="Coupling"
        value={sw.coupling}
        unit=""
        loading={sw.loading}
      />
      <Widget
        label="Delay"
        value={sw.delay != null ? Math.round(sw.delay / 60) : null}
        unit="min"
        loading={sw.loading}
      />

      {/* Freshness dot */}
      <div className="widget" style={{ minWidth: 'auto', padding: '6px 8px' }}>
        <span className="widget-label">Data</span>
        <span
          className="dot"
          style={{ background: freshnessColor(secondsAgo) }}
          title={sw.error ? 'Disconnected' : `${secondsAgo}s ago`}
        />
      </div>

      <div className="dashboard-actions">
        <button
          className={`btn night-btn ${nightVision ? 'btn-accent' : ''}`}
          onClick={toggleNightVision}
          title="Toggle night-vision mode"
        >
          {nightVision ? '🔴' : '👁'} NV
        </button>
      </div>
    </div>
  );
}
