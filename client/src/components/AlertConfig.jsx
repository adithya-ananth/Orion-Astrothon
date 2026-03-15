import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { subscribeNotifications } from '../utils/api';
import useLocation from '../hooks/useLocation';

export default function AlertConfig() {
  const { alertConfig, setAlertConfig } = useAppContext();
  const { lat, lon } = useLocation();
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState(null); // null | 'sending' | 'subscribed' | 'error'

  const handleToggle = (key) => {
    setAlertConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEmailSubscribe = async () => {
    if (!email || !email.includes('@')) return;
    setEmailStatus('sending');
    try {
      await subscribeNotifications(lat, lon, email, alertConfig.scoreThreshold);
      setEmailStatus('subscribed');
    } catch {
      setEmailStatus('error');
    }
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

      {/* Email notification subscription */}
      <div className="config-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="config-label">Email Notifications</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailStatus) setEmailStatus(null);
            }}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font-data)',
            }}
          />
          <button
            onClick={handleEmailSubscribe}
            disabled={emailStatus === 'sending' || !email}
            style={{
              padding: '6px 14px',
              background: emailStatus === 'subscribed' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            {emailStatus === 'sending' ? '…' :
             emailStatus === 'subscribed' ? '✓ Subscribed' :
             'Subscribe'}
          </button>
        </div>
        <span className="config-desc">
          {emailStatus === 'subscribed'
            ? 'You will receive an email when the score exceeds the threshold'
            : emailStatus === 'error'
            ? 'Failed to subscribe — please try again'
            : 'Get notified by email when conditions are favourable'}
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
