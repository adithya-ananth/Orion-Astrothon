# Metrics Calculation Reference

Every metric, score, and derived quantity computed by the Aurora Forecast platform, documented in the format:

> **METRIC** · **Datapoints used** · **Formulae** · **Data source for each datapoint**

---

## 1. Composite Visibility Score

| Field | Detail |
|-------|--------|
| **METRIC** | Composite Visibility Score (0–100) |
| **Datapoints used** | Aurora Probability (0–100), Cloud Score (0–100), Darkness Score (0–100) |
| **Formulae** | `Composite = Aurora_Probability × 0.50 + Cloud_Score × 0.35 + Darkness_Score × 0.15`, clamped to [0, 100] |
| **Data source** | Aurora Probability → NOAA OVATION grid; Cloud Score → Open-Meteo API; Darkness Score → astronomical calculations (see below) |

*Source: `server/app/services/visibility_service.py` lines 16–43; weights from `server/app/utils/constants.py` lines 18–20*

---

## 2. Aurora Probability

| Field | Detail |
|-------|--------|
| **METRIC** | Aurora Probability at a given (lat, lon) — 0 to 100 % |
| **Datapoints used** | OVATION aurora grid (array of `[Longitude, Latitude, Aurora_probability]` points or `{Longitude, Latitude, Aurora}` dicts, 360×181 grid), user latitude, user longitude, current Bz (nT) |
| **Formulae** | Nearest-neighbor interpolation: (1) Normalize user longitude to [0, 360): `norm_lon = ((lon % 360) + 360) % 360`. (2) For each grid point within 5° of the user in both lat and lon, compute squared Euclidean distance: `dist = (p_lat − lat)² + (p_lon − norm_lon)²`. (3) Return the aurora value of the nearest grid point, clamped to [0, 100]. **Bz adjustment**: If Bz < −7 nT, multiply probability by `1 + (|Bz| − 7) × 0.05`, clamped to [0, 100]. This compensates for OVATION's ~30-min update lag when the IMF turns sharply southward. |
| **Data source** | OVATION grid → NOAA SWPC endpoint `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`, updated ~every 30 minutes. Bz → NOAA SWPC magnetometer 1-day data. Staleness threshold: 45 minutes (`OVATION_STALE_S = 2700 s`). |

*Source: `server/app/services/visibility_service.py` lines 97–168*

---

## 3. Cloud Score

| Field | Detail |
|-------|--------|
| **METRIC** | Cloud Score (0–100, higher = clearer sky) |
| **Datapoints used** | Low cloud cover % (`low`), Mid cloud cover % (`mid`), High cloud cover % (`high`) |
| **Formulae** | `weighted_pct = (low × 2 + mid × 1.5 + high × 0.5) / 4` then `Cloud_Score = 100 − weighted_pct`, clamped to [0, 100]. Rationale: low stratus clouds obstruct visibility most (weight 2.0×), mid-level altocumulus moderately (1.5×), high cirrus least (0.5×). If all cloud values are `None`, returns 50 (moderate assumption). |
| **Data source** | Low/Mid/High cloud cover → Open-Meteo API: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high`. Cached per 0.5° grid cell for 15 minutes (`WEATHER_CACHE_S = 900 s`). |

*Source: `server/app/services/visibility_service.py` lines 95–118; `server/app/services/weather_service.py` lines 26–66*

---

## 4. Darkness Score

| Field | Detail |
|-------|--------|
| **METRIC** | Darkness Score (0–100, higher = darker sky) |
| **Datapoints used** | Sun altitude (degrees), Moon altitude (degrees), Lunar illumination fraction (0–1), Observer latitude/longitude (for Bortle estimate) |
| **Formulae** | `Darkness = sun_contribution − moon_penalty + bortle_bonus`, clamped to [0, 100]. **Sun contribution** (based on altitude): sun < −18° → +60 pts (astronomical twilight); −18° ≤ sun < −12° → +40 pts (nautical twilight); −12° ≤ sun < −6° → +20 pts (civil twilight); −6° ≤ sun < 0° → +5 pts; sun ≥ 0° → 0 pts. **Moon penalty**: `moon_penalty = lunar_illumination × 30` (only applied when moon altitude > 0°). Full moon (illumination = 1.0) → −30 pts; new moon (0.0) → 0 pts. **VIIRS-based Bortle bonus**: `bortle_bonus = (9 − bortle_class) × 2.5`, clamped to [0, 20]. Bortle class estimated from VIIRS nighttime-lights reference points using quartic radiance decay (1/d⁴). Urban areas (Bortle 8–9) → 0–2.5 pts; rural areas (Bortle 3–4) → 12.5–15 pts; excellent dark sites (Bortle 1–2) → 17.5–20 pts. |
| **Data source** | Sun altitude → computed via `solar_position(lat, lon, dt)` (see §10). Moon altitude → computed via `lunar_position(lat, lon, dt)` (see §11). Lunar illumination → computed via `lunar_phase(dt)` (see §12). Bortle class → VIIRS-inspired light-pollution reference data (see §16a). |

*Source: `server/app/services/visibility_service.py` lines 171–235*

---

## 5. Newell Coupling Function

| Field | Detail |
|-------|--------|
| **METRIC** | Newell Coupling Parameter (dΦ/dt) — dimensionless, higher = stronger solar wind–magnetosphere coupling |
| **Datapoints used** | Bz (IMF Z-component, nT), By (IMF Y-component, nT), Solar wind speed (km/s) |
| **Formulae** | `Bt = √(By² + Bz²)` (transverse IMF magnitude). `θ = atan2(\|By\|, Bz)` (IMF clock angle). `dΦ/dt = v^(4/3) × Bt^(2/3) × sin^(8/3)(θ/2)`. Returns 0 if Bt = 0 or speed ≤ 0. |
| **Data source** | Bz, By → NOAA SWPC magnetometer 1-day data (`https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json`), columns bz_gsm (index 3) and by_gsm (index 2). Speed → NOAA SWPC plasma 1-day data (`https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json`), column speed (index 2). Both updated every ~1 minute. Staleness: 5 minutes (`MAG_STALE_S = 300 s`, `PLASMA_STALE_S = 300 s`). |

*Source: `server/app/services/solar_wind_service.py` lines 101–115*

---

## 6. Propagation Delay

| Field | Detail |
|-------|--------|
| **METRIC** | Propagation Delay — time for solar wind to travel from L1 to Earth (seconds) |
| **Datapoints used** | Solar wind speed (km/s) |
| **Formulae** | `delay = L1_DISTANCE_KM / speed = 1.5 × 10⁶ km / speed(km/s)`. Example: at 400 km/s → ~3750 s (~62.5 min); at 600 km/s → ~2500 s (~41.7 min). Returns `None` if speed ≤ 0. |
| **Data source** | Speed → NOAA SWPC plasma 1-day data (`plasma-1-day.json`, column index 2). Constant `L1_DISTANCE_KM = 1.5e6` km (Sun-Earth L1 Lagrange point distance). |

*Source: `server/app/services/solar_wind_service.py` lines 118–122; `server/app/utils/constants.py` line 29*

---

## 7. Bz Threshold Alert

| Field | Detail |
|-------|--------|
| **METRIC** | Bz Southward Alert — fires when IMF Bz turns strongly southward |
| **Datapoints used** | Bz (nT) |
| **Formulae** | Alert triggers when `Bz < −7 nT` (`BZ_ALERT_THRESHOLD = −7`). Severity: **critical** if `Bz < −14 nT` (i.e. `Bz < threshold × 2`); **warning** if `−14 nT ≤ Bz < −7 nT`. |
| **Data source** | Bz → NOAA SWPC magnetometer 1-day data (`mag-1-day.json`, column bz_gsm, index 3). |

*Source: `server/app/services/solar_wind_service.py` lines 125–136*

---

## 8. Speed Threshold Alert

| Field | Detail |
|-------|--------|
| **METRIC** | High-Speed Solar Wind Alert — fires during high-speed solar wind streams |
| **Datapoints used** | Solar wind speed (km/s) |
| **Formulae** | Alert triggers when `speed > 500 km/s` (`SPEED_ALERT_THRESHOLD = 500`). Severity: **critical** if `speed > 750 km/s` (i.e. `speed > threshold × 1.5`); **warning** if `500 < speed ≤ 750 km/s`. |
| **Data source** | Speed → NOAA SWPC plasma 1-day data (`plasma-1-day.json`, column speed, index 2). |

*Source: `server/app/services/solar_wind_service.py` lines 139–150*

---

## 9. Substorm Precursor Detection

| Field | Detail |
|-------|--------|
| **METRIC** | Substorm Precursor Alert — detects rapid southward Bz turning |
| **Datapoints used** | Rolling 30-minute history of Bz readings (timestamp + Bz value pairs) |
| **Formulae** | For each consecutive Bz pair: `dBz = Bz[i] − Bz[i−1]`, `dt_min = (t[i] − t[i−1]) / 60`. Only southward turning counted: `rate = \|dBz\| / dt_min` when `dBz < 0`, else `rate = 0`. Alert fires when `rate > 2 nT/min` (`SUBSTORM_DBZ_RATE = 2`) is sustained for ≥ 5 consecutive minutes (`SUBSTORM_SUSTAINED_MIN = 5`). History window: last 30 minutes (`BZ_HISTORY_MINUTES = 30`). |
| **Data source** | Bz → NOAA SWPC magnetometer 1-day data (`mag-1-day.json`), recorded into an in-memory rolling history buffer every time new data arrives. |

*Source: `server/app/services/solar_wind_service.py` lines 153–191*

---

## 10. Solar Position (Altitude & Azimuth)

| Field | Detail |
|-------|--------|
| **METRIC** | Sun altitude (degrees above/below horizon) and azimuth (degrees from north) |
| **Datapoints used** | Observer latitude, observer longitude, UTC datetime |
| **Formulae** | Julian centuries since J2000.0: `T = (JD − 2451545.0) / 36525`. Mean longitude: `L0 = 280.46646 + 36000.76983T + 0.0003032T²`. Mean anomaly: `M = 357.52911 + 35999.05029T − 0.0001537T²`. Equation of center: `C = (1.914602 − 0.004817T − 0.000014T²)sin(M) + (0.019993 − 0.000101T)sin(2M) + 0.000289sin(3M)`. True longitude: `sun_lon = L0 + C`. Obliquity: `ε = 23.439291 − 0.0130042T`. Declination: `sin(δ) = sin(ε)sin(sun_lon)`. Right ascension: `α = atan2(cos(ε)sin(sun_lon), cos(sun_lon))`. GMST: `280.46061837 + 360.98564736629 × (JD − 2451545)`. Local sidereal time: `LST = GMST + lon`. Hour angle: `HA = LST − α`. Altitude: `sin(alt) = sin(lat)sin(δ) + cos(lat)cos(δ)cos(HA)`. Azimuth: `cos(az) = (sin(δ) − sin(lat)sin(alt)) / (cos(lat)cos(alt))`, adjusted for hemisphere. |
| **Data source** | Pure computation from observer coordinates and UTC time. No external API. |

*Source: `server/app/utils/astronomy.py` lines 29–92*

---

## 11. Lunar Position (Altitude & Azimuth)

| Field | Detail |
|-------|--------|
| **METRIC** | Moon altitude (degrees) and azimuth (degrees) |
| **Datapoints used** | Observer latitude, observer longitude, UTC datetime |
| **Formulae** | Julian centuries: `T`. Mean longitude: `Lm = 218.3165 + 481267.8813T`. Mean elongation: `D = 297.8502 + 445267.1115T`. Sun mean anomaly: `M = 357.5291 + 35999.0503T`. Moon mean anomaly: `Mm = 134.9634 + 477198.8676T`. Argument of latitude: `F = 93.2720 + 483202.0175T`. Ecliptic longitude: `moon_lon = Lm + 6.289sin(Mm) + 1.274sin(2D−Mm) + 0.658sin(2D) + 0.214sin(2Mm) − 0.186sin(M)`. Ecliptic latitude: `moon_lat = 5.128sin(F) + 0.281sin(Mm+F) + 0.278sin(Mm−F)`. Then ecliptic → equatorial conversion and altitude/azimuth calculation (same as solar). |
| **Data source** | Pure computation from observer coordinates and UTC time. No external API. |

*Source: `server/app/utils/astronomy.py` lines 95–163*

---

## 12. Lunar Phase (Illumination Fraction)

| Field | Detail |
|-------|--------|
| **METRIC** | Lunar illumination fraction (0.0 = new moon, 1.0 = full moon) |
| **Datapoints used** | UTC datetime |
| **Formulae** | Reference new moon: January 6, 2000, 18:14 UTC. `days_since = (current_timestamp − reference_timestamp) / 86400`. Synodic month: `29.53059 days`. Phase position: `phase = days_since mod 29.53059`. Illumination: `illumination = (1 − cos(phase / 29.53059 × 2π)) / 2`. |
| **Data source** | Pure computation from current UTC time and the known synodic month constant. No external API. |

*Source: `server/app/utils/astronomy.py` lines 166–175*

---

## 13. Astronomical Twilight Detection

| Field | Detail |
|-------|--------|
| **METRIC** | Boolean — whether it is astronomical twilight (full dark sky) |
| **Datapoints used** | Sun altitude at observer's location |
| **Formulae** | `is_astronomical_twilight = (sun_altitude < −18°)` |
| **Data source** | Sun altitude → computed via `solar_position(lat, lon, dt)` (see §10). No external API. |

*Source: `server/app/utils/astronomy.py` lines 178–181*

---

## 14. Day/Night Terminator Line

| Field | Detail |
|-------|--------|
| **METRIC** | List of (lat, lon) points forming the day/night boundary on a map |
| **Datapoints used** | UTC datetime (to compute solar declination and GMST) |
| **Formulae** | Compute solar declination (`δ`) from Julian centuries. Compute GMST. For each longitude from −180° to +180° in 2° steps: `HA = (GMST + lon)` in radians, `tan(lat) = −cos(HA) / tan(δ)`, `lat = atan(tan(lat))`. Only points where −90° ≤ lat ≤ 90° are included. |
| **Data source** | Pure computation from UTC time. No external API. Client also computes this independently using the SunCalc library (`client/src/utils/terminator.js`) with a binary search approach. |

*Source: `server/app/utils/astronomy.py` lines 184–208; `client/src/utils/terminator.js` lines 7–66*

---

## 15. Magnetic Midnight

| Field | Detail |
|-------|--------|
| **METRIC** | Magnetic midnight UTC hour — optimal aurora viewing time at a location |
| **Datapoints used** | Observer longitude, geomagnetic pole longitude |
| **Formulae** | Solar midnight: `solar_midnight_utc = 24 − (lon / 15)`. Geomagnetic pole longitude: `−72.6°` (IGRF dipole approximation). MLT offset: `mlt_offset_hours = (lon − (−72.6)) / 15`. Magnetic midnight: `mag_midnight_utc = (solar_midnight_utc − mlt_offset_hours + 24) mod 24`. |
| **Data source** | Pure computation from observer longitude and the geomagnetic dipole pole longitude constant. No external API. |

*Source: `server/app/services/visibility_service.py` lines 175–208*

---

## 16a. VIIRS-Based Bortle Class Estimation

| Field | Detail |
|-------|--------|
| **METRIC** | Estimated Bortle class (1–9) at a given (lat, lon) |
| **Datapoints used** | Observer latitude, observer longitude, VIIRS nighttime-lights reference points |
| **Formulae** | For each reference city, compute Euclidean distance to query point. If distance < 0.1°, assign city's radiance directly. Otherwise, use quartic decay: `contribution = radiance / d⁴` (where d is angular distance in degrees). Aggregate contributions from all cities within 5° influence radius, plus a background radiance of 2.0 nW. Map aggregate radiance to Bortle class: ≥100 → 8, ≥50 → 7, ≥25 → 6, ≥10 → 5, ≥5 → 4, ≥2 → 3, ≥0.5 → 2, <0.5 → 1. |
| **Data source** | VIIRS nighttime-lights reference data — 24 representative cities with approximate VIIRS radiance values (nW/cm²/sr), embedded as static reference data. Inspired by NASA/NOAA VIIRS Day-Night Band data. |

*Source: `server/app/services/visibility_service.py` lines 70–95, 171–219*

---

## 16b. Bz-Adjusted Aurora Probability

| Field | Detail |
|-------|--------|
| **METRIC** | Bz-adjusted Aurora Probability — compensates for OVATION update lag |
| **Datapoints used** | Raw OVATION aurora probability, current Bz (nT) |
| **Formulae** | If Bz ≥ −7 nT or Bz is null: no adjustment (return raw probability). If Bz < −7 nT: `adjusted = probability × (1 + (|Bz| − 7) × 0.05)`, clamped to [0, 100]. Rationale: OVATION updates ~every 30 min, but Bz can change rapidly. Strongly southward Bz (< −7 nT) increases aurora likelihood that OVATION hasn't yet captured. |
| **Data source** | Raw probability → OVATION grid (§2). Bz → NOAA SWPC magnetometer 1-day data (§20). |

*Source: `server/app/services/visibility_service.py` lines 154–168*

---

## 16c. OVATION Reliability Check

| Field | Detail |
|-------|--------|
| **METRIC** | OVATION data reliability flag — indicates whether OVATION reflects current conditions |
| **Datapoints used** | Rolling Bz history (timestamp + value pairs) |
| **Formulae** | For each consecutive Bz pair, compute `rate = |dBz| / dt_min`. If any rate exceeds 2 nT/min (`SUBSTORM_DBZ_RATE`), return `reliable: false` with the maximum observed rate and explanation. Otherwise return `reliable: true`. |
| **Data source** | Bz history → in-memory rolling buffer from NOAA SWPC magnetometer data. |

*Source: `server/app/services/solar_wind_service.py` lines 200–238*

---

## 16. Photography Settings Recommendations

| Field | Detail |
|-------|--------|
| **METRIC** | Recommended camera settings (ISO, aperture, shutter speed, color prediction, aurora emission color) |
| **Datapoints used** | Kp index value (0–9 scale) |
| **Formulae** | Threshold-based lookup: Kp ≥ 7 → ISO 800, f/2.8, 8 s; Kp 5–6 → ISO 1600, f/2.8, 10 s; Kp 3–4 → ISO 3200, f/2.8, 15 s; Kp 0–2 → ISO 6400, f/2.0, 20 s. Additional tip: if Kp ≥ 5 → "fast-moving aurora — reduce exposure time"; if Kp < 5 → "slow aurora — longer exposures are fine". **Aurora emission color prediction**: Kp < 5 → "Green (557.7nm atomic oxygen dominant)"; Kp 5–6 → "Green with possible red upper fringes"; Kp > 6 → "Green and red (high altitude oxygen excited)". |
| **Data source** | Kp index → NOAA SWPC Kp endpoint (`https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`), passed as query parameter by the user. |

*Source: `server/app/routes/photography.py` lines 9–60*

---

## 17. Location Alert Check (Aurora Likely)

| Field | Detail |
|-------|--------|
| **METRIC** | AURORA_LIKELY alert — fires when aurora probability exceeds 50% at a location |
| **Datapoints used** | Aurora probability at (lat, lon), solar wind alerts |
| **Formulae** | If `aurora_probability > 50` → emit alert. Severity: **critical** if `probability > 80`; **warning** if `50 < probability ≤ 80`. Also aggregates all solar wind alerts (Bz, speed, substorm). `shouldNotify = true` if any alerts are active. |
| **Data source** | Aurora probability → OVATION grid (see §2). Solar wind alerts → Bz, speed, substorm detectors (see §7–9). |

*Source: `server/app/routes/alerts.py` lines 48–78*

---

## 18. Kp Index (Current)

| Field | Detail |
|-------|--------|
| **METRIC** | Planetary Kp index (0–9 scale) — measure of global geomagnetic activity |
| **Datapoints used** | Raw Kp array from NOAA |
| **Formulae** | No computation — raw values are fetched and served directly. |
| **Data source** | NOAA SWPC: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`. Updated every 3 hours. |

*Source: `server/app/services/noaa_service.py` lines 199–207*

---

## 19. 3-Day Kp Forecast

| Field | Detail |
|-------|--------|
| **METRIC** | Predicted Kp values for the next 3 days (8 time slots per day = 24 entries) |
| **Datapoints used** | NOAA 3-day plain-text forecast |
| **Formulae** | Text parsing: (1) Extract 3 date headers via regex `[A-Z][a-z]{2}\s+\d{1,2}`. (2) Parse 8 time-slot rows (00-03UT through 21-00UT). (3) Extract numeric Kp values, strip NOAA scale tags like `(G1)`. (4) Return chronologically ordered list of `{"time_tag": "Mar 15 00-03UT", "kp": 4.0}`. |
| **Data source** | NOAA SWPC: `https://services.swpc.noaa.gov/text/3-day-forecast.txt`. Updated ~twice daily. |

*Source: `server/app/services/noaa_service.py` lines 66–132*

---

## 20. Solar Wind Raw Conditions

| Field | Detail |
|-------|--------|
| **METRIC** | Raw solar wind telemetry — Bz, By, Bx, Bt, speed, density, temperature |
| **Datapoints used** | Magnetometer data columns: bx_gsm (index 1), by_gsm (index 2), bz_gsm (index 3), bt (index 6). Plasma data columns: density (index 1), speed (index 2), temperature (index 3). |
| **Formulae** | No computation — values are extracted from the last row of the JSON arrays (most recent reading). DSCOVR → ACE failover: if recent magnetometer rows have null/empty Bz, data is re-fetched and source flagged as `ACE_FAILOVER`. |
| **Data source** | Magnetometer → `https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json`. Plasma → `https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json`. Both at ~1-minute cadence from DSCOVR satellite (primary) or ACE satellite (backup). |

*Source: `server/app/services/solar_wind_service.py` lines 48–98; `server/app/services/noaa_service.py` lines 143–183*

---

## Client-Side Color Mappings

These are visual-only metrics (no physics computation) used for UI rendering:

### 21. Aurora Probability Color Ramp

| Field | Detail |
|-------|--------|
| **METRIC** | RGBA color for aurora probability overlay on map |
| **Datapoints used** | Aurora probability (0–100) |
| **Formulae** | 0% → transparent. 1–20% → green ramp with increasing opacity `(0, 0–200, 0–50, 0–0.3)`. 21–50% → green→yellow `(0–200, 200–255, 0, 0.5)`. 51–80% → yellow→red `(200–255, 255–0, 0, 0.65)`. 81–100% → red→magenta `(255, 0–30, 0–200, 0.8)`. |

*Source: `client/src/utils/colors.js` lines 5–24*

### 22. Kp Index Color

| Field | Detail |
|-------|--------|
| **METRIC** | Hex color for Kp index display |
| **Datapoints used** | Kp value (0–9) |
| **Formulae** | Kp 0–3 → green `#00ff88`; Kp 4–5 → yellow `#ffdd00`; Kp 6–7 → red `#ff4444`; Kp 8–9 → magenta `#ff44ff`. |

*Source: `client/src/utils/colors.js` lines 27–32*

### 23. Visibility Score Color

| Field | Detail |
|-------|--------|
| **METRIC** | Hex color for visibility score display |
| **Datapoints used** | Visibility score (0–100) |
| **Formulae** | Score 0–29 → red `#ff4444`; Score 30–59 → yellow `#ffdd00`; Score 60–100 → green `#00ff88`. |

*Source: `client/src/utils/colors.js` lines 34–39*

### 24. Bz Indicator Color

| Field | Detail |
|-------|--------|
| **METRIC** | Hex color for Bz value display |
| **Datapoints used** | Bz value (nT) |
| **Formulae** | Bz > 0 → green `#00ff88` (northward, unfavorable for aurora). −5 ≤ Bz ≤ 0 → yellow `#ffdd00` (marginal). Bz < −5 → red `#ff4444` (southward, favorable). |

*Source: `client/src/utils/colors.js` lines 42–46*

### 25. Solar Wind Speed Color

| Field | Detail |
|-------|--------|
| **METRIC** | Hex color for solar wind speed display |
| **Datapoints used** | Speed (km/s) |
| **Formulae** | Speed < 400 → green `#00ff88`; 400–500 → yellow `#ffdd00`; > 500 → red `#ff4444`. |

*Source: `client/src/utils/colors.js` lines 49–53*

### 26. Data Freshness Color

| Field | Detail |
|-------|--------|
| **METRIC** | Hex color for data age indicator |
| **Datapoints used** | Seconds since last data update |
| **Formulae** | < 120 s (2 min) → green `#00ff88`; 120–600 s (2–10 min) → yellow `#ffdd00`; > 600 s (10 min) → red `#ff4444`. |

*Source: `client/src/utils/colors.js` lines 56–60*

---

## Constants Summary

All magic numbers are defined in `server/app/utils/constants.py`:

| Constant | Value | Used by |
|----------|-------|---------|
| `BZ_ALERT_THRESHOLD` | −7 nT | Bz Southward Alert (§7) |
| `BZ_AURORA_BOOST_THRESHOLD` | −7 nT | Bz Aurora Probability Adjustment (§16b) |
| `BZ_AURORA_BOOST_FACTOR` | 0.05 | Bz Aurora Probability Adjustment (§16b) |
| `SPEED_ALERT_THRESHOLD` | 500 km/s | Speed Alert (§8) |
| `SUBSTORM_DBZ_RATE` | 2 nT/min | Substorm Precursor (§9), OVATION Reliability (§16c) |
| `SUBSTORM_SUSTAINED_MIN` | 5 min | Substorm Precursor (§9) |
| `AURORA_WEIGHT` | 0.50 | Composite Visibility (§1) |
| `CLOUD_WEIGHT` | 0.35 | Composite Visibility (§1) |
| `DARKNESS_WEIGHT` | 0.15 | Composite Visibility (§1) |
| `MAG_STALE_S` | 300 s (5 min) | Magnetometer staleness |
| `PLASMA_STALE_S` | 300 s (5 min) | Plasma data staleness |
| `OVATION_STALE_S` | 2700 s (45 min) | OVATION grid staleness |
| `WEATHER_CACHE_S` | 900 s (15 min) | Weather cache TTL |
| `L1_DISTANCE_KM` | 1.5 × 10⁶ km | Propagation Delay (§6) |
| `BZ_HISTORY_MINUTES` | 30 min | Substorm Precursor (§9) |

---

## Data Sources Summary

| Source | URL | Data Provided | Update Cadence |
|--------|-----|---------------|----------------|
| NOAA SWPC Magnetometer | `products/solar-wind/mag-1-day.json` | Bz, By, Bx, Bt (IMF components) | ~1 minute |
| NOAA SWPC Plasma | `products/solar-wind/plasma-1-day.json` | Speed, density, temperature | ~1 minute |
| NOAA SWPC OVATION | `json/ovation_aurora_latest.json` | 360×181 aurora probability grid | ~30 minutes |
| NOAA SWPC Kp Index | `products/noaa-planetary-k-index.json` | Planetary Kp values | ~3 hours |
| NOAA SWPC 3-Day Forecast | `text/3-day-forecast.txt` | Predicted Kp (3 days, 8 slots/day) | ~2× daily |
| NOAA SWPC Alerts | `products/alerts.json` | Space weather watches/warnings | Event-driven |
| Open-Meteo Weather | `api.open-meteo.com/v1/forecast` | Cloud cover (total, low, mid, high) | Real-time (cached 15 min) |
| VIIRS Nighttime Lights | N/A (embedded reference data) | Light pollution / Bortle class estimation | Static (24 reference cities) |
| Astronomical Calculations | N/A (computed locally) | Sun/Moon position, lunar phase, terminator | Real-time |
