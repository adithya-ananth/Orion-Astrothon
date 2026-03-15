import React, { useMemo } from 'react';
import useVisibility from '../hooks/useVisibility';
import { scoreColor } from '../utils/colors';
import { getMagneticMidnight } from '../utils/terminator';

const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52

function CircularGauge({ score, loading }) {
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const color = score != null ? scoreColor(score) : 'var(--text-secondary)';

  return (
    <div className="gauge-container">
      <div className="gauge-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle className="gauge-bg" cx="60" cy="60" r="52" />
          <circle
            className="gauge-fill"
            cx="60"
            cy="60"
            r="52"
            stroke={color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={loading ? CIRCUMFERENCE : offset}
          />
        </svg>
        <div className="gauge-text">
          {loading ? (
            <div className="skeleton" style={{ width: 40, height: 28 }} />
          ) : (
            <>
              <div className="gauge-score" style={{ color }}>
                {score != null ? Math.round(score) : '—'}
              </div>
              <div className="gauge-label">/ 100</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownBar({ label, value, color }) {
  return (
    <div className="breakdown-bar">
      <div className="bar-header">
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-data)' }}>
          {value != null ? `${Math.round(value)}%` : '—'}
        </span>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: value != null ? `${Math.min(100, value)}%` : '0%',
            background: color || 'var(--accent)',
          }}
        />
      </div>
    </div>
  );
}

export default function VisibilityPanel({ lat, lon }) {
  const { score, breakdown, bestTime, photography, ovationReliability, bzAdjusted, loading, error } =
    useVisibility(lat, lon);

  const magneticMidnight = useMemo(() => {
    if (!lat || !lon) return null;
    try {
      const dt = getMagneticMidnight(lat, lon);
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [lat, lon]);

  const viewingTime = bestTime || magneticMidnight;

  // Default photography settings based on score
  const photoSettings = photography || {
    iso: score > 60 ? '1600' : '3200',
    aperture: 'f/2.8',
    shutter: score > 60 ? '10s' : '15s',
  };

  return (
    <div className="side-panel">
      <div className="panel-section">
        <h3>Visibility Score</h3>
        <CircularGauge score={score} loading={loading} />

        {error && (
          <p style={{ fontSize: 11, color: 'var(--alert)', textAlign: 'center' }}>
            Unable to fetch visibility data
          </p>
        )}

        {!loading && lat == null && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Waiting for location…
          </p>
        )}
      </div>

      <div className="panel-section">
        <h3>Breakdown</h3>
        <BreakdownBar
          label="Aurora Probability"
          value={breakdown?.aurora}
          color="#00ff88"
        />
        <BreakdownBar
          label="Cloud Cover Score"
          value={breakdown?.cloud}
          color="#4488ff"
        />
        <BreakdownBar
          label="Darkness Score"
          value={breakdown?.darkness}
          color="#aa88ff"
        />
      </div>

      {ovationReliability && !ovationReliability.reliable && (
        <div className="panel-section" style={{ background: 'rgba(255,68,68,0.08)', borderRadius: 8, padding: '8px 12px', marginTop: 4 }}>
          <p style={{ fontSize: 11, color: 'var(--alert)', margin: 0, lineHeight: 1.4 }}>
            ⚠️ OVATION data may be unreliable — rapid Bz changes detected
            (|dBz/dt| = {ovationReliability.max_dbz_dt} nT/min)
          </p>
        </div>
      )}

      {bzAdjusted && (
        <div className="panel-section" style={{ padding: '4px 12px', marginTop: 2 }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
            Aurora probability adjusted for current Bz conditions
          </p>
        </div>
      )}

      {viewingTime && (
        <div className="panel-section">
          <h3>Best Viewing</h3>
          <div className="best-time">
            <span className="time-icon">🌙</span>
            <div>
              <div className="time-value">{viewingTime}</div>
              <div className="time-label">Magnetic midnight (approx.)</div>
            </div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <h3>Photography Settings</h3>
        <div className="photo-rec">
          <div className="rec-item">
            <div className="rec-label">ISO</div>
            <div className="rec-value">{photoSettings.iso}</div>
          </div>
          <div className="rec-item">
            <div className="rec-label">Aperture</div>
            <div className="rec-value">{photoSettings.aperture}</div>
          </div>
          <div className="rec-item">
            <div className="rec-label">Shutter</div>
            <div className="rec-value">{photoSettings.shutterSpeed || photoSettings.shutter}</div>
          </div>
        </div>
        {photoSettings.colorPrediction && (
          <div className="photo-extra">
            <div className="extra-label">Color Prediction</div>
            <div className="extra-value">{photoSettings.colorPrediction}</div>
          </div>
        )}
        {photoSettings.tips && photoSettings.tips.length > 0 && (
          <div className="photo-tips">
            <div className="extra-label">Tips</div>
            <ul className="tips-list">
              {photoSettings.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
