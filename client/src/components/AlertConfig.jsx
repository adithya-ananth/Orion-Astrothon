import React from 'react';
import { useAppContext } from '../contexts/AppContext';

export default function AlertConfig() {
  const { alertConfig, setAlertConfig } = useAppContext();

  const handleToggle = (key) => {
    setAlertConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="panel-section alert-config">
      <h3>Alert Settings</h3>

      {/* Score threshold slider */}
      <div className="config-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="config-label">Score Threshold</span>
          <span
            style={{
              fontFamily: 'var(--font-data)',
              color: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {alertConfig.scoreThreshold}
          </span>
        </div>
        <input
          type="range"
          className="threshold-slider"
          min="10"
          max="90"
          step="5"
          value={alertConfig.scoreThreshold}
          onChange={(e) =>
            setAlertConfig({ scoreThreshold: Number(e.target.value) })
          }
        />
        <span className="config-desc">
          Alert when visibility score exceeds this value
        </span>
      </div>

      {/* Bz alert toggle */}
      <div className="config-row">
        <div>
          <span className="config-label">Bz Alert</span>
          <br />
          <span className="config-desc">Alert when Bz &lt; −7 nT</span>
        </div>
        <div
          className={`toggle-switch ${alertConfig.bzAlert ? 'active' : ''}`}
          onClick={() => handleToggle('bzAlert')}
          role="switch"
          aria-checked={alertConfig.bzAlert}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleToggle('bzAlert')}
        />
      </div>

      {/* Substorm alert toggle */}
      <div className="config-row">
        <div>
          <span className="config-label">Substorm Alert</span>
          <br />
          <span className="config-desc">Alert on substorm onset detection</span>
        </div>
        <div
          className={`toggle-switch ${alertConfig.substormAlert ? 'active' : ''}`}
          onClick={() => handleToggle('substormAlert')}
          role="switch"
          aria-checked={alertConfig.substormAlert}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleToggle('substormAlert')}
        />
      </div>

      {/* Speed alert toggle */}
      <div className="config-row">
        <div>
          <span className="config-label">Speed Alert</span>
          <br />
          <span className="config-desc">Alert when speed &gt; 500 km/s</span>
        </div>
        <div
          className={`toggle-switch ${alertConfig.speedAlert ? 'active' : ''}`}
          onClick={() => handleToggle('speedAlert')}
          role="switch"
          aria-checked={alertConfig.speedAlert}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleToggle('speedAlert')}
        />
      </div>
    </div>
  );
}
