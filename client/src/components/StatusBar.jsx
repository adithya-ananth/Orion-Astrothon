import React from 'react';
import useSolarWind from '../hooks/useSolarWind';
import { useAppContext } from '../contexts/AppContext';
import { freshnessColor } from '../utils/colors';

export default function StatusBar() {
  const sw = useSolarWind();
  const { alertsActive } = useAppContext();

  const secondsAgo = sw.timestamp
    ? Math.floor((Date.now() - new Date(sw.timestamp).getTime()) / 1000)
    : Infinity;

  const formatAge = (s) => {
    if (!isFinite(s)) return '—';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  return (
    <div className="status-bar">
      <div className="status-item">
        <span
          className="dot"
          style={{
            background: sw.error ? 'var(--alert)' : freshnessColor(secondsAgo),
          }}
        />
        {sw.error ? 'Connecting…' : 'Connected'}
      </div>

      <div className="status-item">
        Source: <strong style={{ marginLeft: 3 }}>{sw.source || '—'}</strong>
      </div>

      <div className="status-item">Updated: {formatAge(secondsAgo)}</div>

      {alertsActive.length > 0 && (
        <div className="status-item">
          <span className="badge alert-badge">{alertsActive.length}</span>
          <span style={{ marginLeft: 4 }}>alerts</span>
        </div>
      )}
    </div>
  );
}
