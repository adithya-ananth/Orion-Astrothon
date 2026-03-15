# Aurora Forecast — Hyper-Local Aurora Forecasting & Astrophotographer Intelligence Platform

> **Orion Astrathon** — Space Weather & Aurora Forecasting

A real-time, hyper-local aurora forecasting and visualization platform that bridges the gap between raw space weather telemetry and on-the-ground visibility intelligence for astrophotographers, researchers, and enthusiasts.

---

## Features

### D1 — Live Data Pipeline
- Polls 6 NOAA SWPC endpoints at native cadences (1-min mag/plasma, 30-min OVATION, 3-hr Kp)
- DSCOVR → ACE failover with data gap detection
- Newell Coupling Parameter computation
- Dynamic propagation delay: Δt = 1.5×10⁶ km / v(km/s)
- Data staleness tracking and flagging

### D2 — Interactive Aurora Map
- Leaflet dark map with OVATION 360×181 probability grid overlay
- Color-ramped aurora probability: green → yellow → red → magenta
- Day/night terminator overlay (SunCalc-powered)
- User location marker with 500 km viewing radius
- Click-to-query: tap any point to get its visibility score
- Auto-refresh on OVATION updates

### D3 — Visibility Score Engine
- Composite 0–100 score per location:
  - **Aurora probability** (50% weight) — interpolated from OVATION grid, with real-time Bz adjustment
  - **Cloud cover** (35% weight) — layer-separated (low stratus weighted 2x vs. high cirrus) via Open-Meteo
  - **Darkness** (15% weight) — sun altitude + moon illumination × altitude + VIIRS-based Bortle estimate
- Bz adjustment: when Bz < −7 nT, aurora probability is boosted by `1 + (|Bz| − 7) × 0.05`, capped at 100%
- VIIRS-inspired light-pollution model differentiates urban vs. rural darkness scores
- Queryable for any lat/lon in real time

### D4 — Alert System
- Configurable visibility score threshold alerts
- Raw Bz alert: fires at Bz < −7 nT regardless of composite score
- Substorm precursor: dBz/dt > 2 nT/min sustained 5 min → "Watch the sky now"
- Solar wind speed alert: fires at v > 500 km/s
- OVATION reliability flag: when |dBz/dt| > 2 nT/min, OVATION data is flagged as potentially unreliable
- Magnetic midnight window per location as daily optimal viewing schedule
- **Email notification system**: subscribe with location + email + score threshold; background loop checks every 5 minutes and sends email on first breach with anti-spam flag logic (no duplicate emails until score drops and re-breaches)

### Stretch Goals
- **Photography Settings Advisor** — ISO, aperture, shutter recommendations based on Kp level + aurora color prediction (Kp-dependent emission line)
- **Substorm Early Warning** — real-time dBz/dt monitoring with 10-minute precursor alerts
- **Night-Vision Mode** — red-tinted UI for field use
- **PWA Manifest** — offline-capable progressive web app structure

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    React Frontend                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Aurora Map    │ │ Visibility   │ │ Solar Wind   │ │
│  │ (Leaflet)    │ │ Panel        │ │ Dashboard    │ │
│  │ + OVATION    │ │ + Score      │ │ + Alerts     │ │
│  │ + Terminator │ │ + Breakdown  │ │ + Kp Chart   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────────────┐
│               FastAPI Backend (Python)                │
│  ┌──────────┐ ┌─────────────┐ ┌───────────────────┐ │
│  │ NOAA     │ │ Visibility  │ │ Solar Wind        │ │
│  │ Service  │ │ Service     │ │ Service           │ │
│  │ (polling)│ │ (scoring)   │ │ (Newell, dBz/dt)  │ │
│  └─────┬────┘ └──────┬──────┘ └────────┬──────────┘ │
│        │       ┌──────▼──────┐  ┌──────▼──────────┐ │
│        │       │ Weather     │  │ Notification    │ │
│        │       │ Service     │  │ Service (SMTP)  │ │
│        │       │ (Open-Meteo)│  │ (email alerts)  │ │
│        │       └─────────────┘  └─────────────────┘ │
└────────┼────────────────────────────────┼────────────┘
         │                                │
    NOAA SWPC                        Astronomical
    (DSCOVR/ACE)                     Calculations
```

---

## Quick Start

### Prerequisites
- Python ≥ 3.10
- Node.js ≥ 18 (for the React frontend)
- npm ≥ 9

### Backend
```bash
cd server
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000   # Starts on port 5000
```

#### Email Notifications (optional)
Set SMTP environment variables to enable email delivery:
```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=you@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM=you@gmail.com
```
If SMTP is not configured, subscriptions are still tracked but emails are silently skipped.

### Frontend
```bash
cd client
npm install
npm start        # Starts on port 3000 (proxies API to 5000)
```

### Production Build
```bash
cd client
npm run build    # Creates optimized static build in client/build/
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health + data freshness status |
| `/api/solar-wind/latest` | GET | Latest Bz, speed, density, coupling, propagation delay |
| `/api/solar-wind/history` | GET | 24h mag + plasma history |
| `/api/solar-wind/alerts` | GET | Active threshold alerts (Bz, speed, substorm) |
| `/api/ovation/latest` | GET | Full OVATION probability grid |
| `/api/ovation/probability?lat=X&lon=Y` | GET | Aurora probability at point |
| `/api/visibility/score?lat=X&lon=Y` | GET | Composite visibility score + breakdown |
| `/api/visibility/magnetic-midnight?lat=X&lon=Y` | GET | Magnetic midnight window |
| `/api/forecast/kp` | GET | Current + historical Kp index |
| `/api/forecast/3day` | GET | 3-day Kp forecast |
| `/api/alerts/active` | GET | All active alerts |
| `/api/alerts/configure` | POST | Save alert config |
| `/api/alerts/check?lat=X&lon=Y` | GET | Check alert conditions for location |
| `/api/photography/settings?kp=X` | GET | Camera settings recommendation |
| `/api/notifications/subscribe` | POST | Subscribe to email alerts (body: lat, lon, email, threshold) |
| `/api/notifications/unsubscribe/{id}` | DELETE | Remove notification subscription |
| `/api/notifications/subscribers` | GET | List all notification subscribers |

---

## Visibility Score Algorithm

The composite score (0–100) is computed as:

```
Score = aurora_prob × 0.50 + cloud_score × 0.35 + darkness_score × 0.15
```

**Aurora Probability (50%)**: Nearest-neighbor interpolation from OVATION 360×181 grid, with real-time Bz adjustment. When instantaneous Bz < −7 nT, the probability is boosted by `1 + (|Bz| − 7) × 0.05` to capture rapid IMF changes between OVATION's 30-min updates.

**Cloud Score (35%)**: Layer-separated from Open-Meteo. Low stratus weighted 2× (worst for visibility) vs. high cirrus at 0.5×:
```
weighted_pct = (low×2 + mid×1.5 + high×0.5) / 4
cloud_score = 100 - weighted_pct
```

**Darkness Score (15%)**: Sun altitude (0–60 pts), moon penalty (0–30 pts), VIIRS-based Bortle bonus (0–20 pts):
- Astronomical twilight (sun < −18°): 60 pts
- Nautical twilight (sun < −12°): 40 pts
- Civil twilight (sun < −6°): 20 pts
- Moon penalty: illumination_fraction × 30 (only when moon above horizon)
- Bortle bonus: VIIRS-inspired light pollution model (urban → 0 pts, rural → up to 20 pts)

**OVATION Reliability**: When |dBz/dt| > 2 nT/min, OVATION data is flagged as potentially unreliable since the IMF is changing faster than the 30-min update cadence.

---

## Tests

```bash
cd server
pip install -r requirements.txt
python -m pytest tests/ -v    # Runs 99 unit tests
```

Tests cover:
- Visibility score computation with known inputs
- Cloud weighting (low stratus vs. cirrus)
- Newell coupling function
- Bz and speed threshold checks
- Substorm detection (dBz/dt sustained rate)
- OVATION reliability flag (dBz/dt > 2 nT/min)
- Solar position at known coordinates
- Lunar phase calculation
- Astronomical twilight detection
- Day/night terminator computation
- Bz-based aurora probability adjustment
- VIIRS-based Bortle class estimation (urban vs. rural)
- Aurora color prediction by Kp level
- Photography settings recommendations
- Email notification subscribe/unsubscribe
- Anti-spam flag cycle (breach → notify → skip → drop → reset → breach → notify)

---

## Data Sources

| Source | Data | Cadence |
|--------|------|---------|
| NOAA SWPC mag-1-day | IMF Bz, By, Bx, Bt | 1 min |
| NOAA SWPC plasma-1-day | Speed, density, temperature | 1 min |
| NOAA SWPC OVATION | 360×181 aurora probability | ~30 min |
| NOAA SWPC Kp index | Planetary Kp | 3 hrs |
| NOAA SWPC 3-day forecast | Predicted Kp | 2× daily |
| NOAA SWPC alerts | Geomagnetic alerts/watches | Event-driven |
| Open-Meteo | Cloud cover (low/mid/high) | 15 min cache |
| VIIRS Nighttime Lights | Light pollution reference (Bortle) | Static reference data |

---

## License

MIT