# Better Alternatives for Production

This application uses entirely free, open-source endpoints to rapidly deliver a functional MVP without hitting rate limits or requiring API keys. However, for a production-level astrophotographer tool, the following upgrades are recommended to achieve maximum scientific fidelity as outlined in the problem statement.

## 1. Darkness & Bortle Class Calculation
**Current Implementation:**
The darkness score is highly accurate for Solar and Lunar altitudes and lunar illumination (using the `ephem` library to calculate actual astronomical twilight). However, the "Bortle Class" component uses a baseline static approximation to avoid loading large raster files.

**Better Alternative:**
To accurately implement the D3 requirement ("Bortle class from VIIRS raster"), the backend should be upgraded to process the **NOAA VIIRS DNB (Day/Night Band) GeoTIFF**.
- **How to implement:** Set up a background worker or a PostGIS database that ingests the VIIRS GeoTIFF. Use a spatial query (like `rasterio` in Python) to lookup the specific pixel value at the user's Lat/Lon and map the radiance value to the 1-9 Bortle Scale.
- **Alternative API:** If self-hosting the raster is too heavy, a paid API like LightPollutionMap.info API could be used to query precise Bortle values.

## 2. Logistical Routing (Stretch Goal)
**Current Implementation:**
The application accurately computes the visibility score for any given point. To find the "nearest dark sky," a user must manually input coordinates.

**Better Alternative:**
- **How to implement:** Integrate **Mapbox Isochrone API** or **Google Maps Directions API**.
- The backend would perform a radial search using PostGIS (checking OVATION grids, Cloud Cover APIs, and VIIRS raster simultaneously) to find the closest coordinate with `Score > 80`. Then, pass that coordinate to Mapbox to calculate the driving route.

## 3. Substorm Rate of Change Monitoring
**Current Implementation:**
We compute $dBz/dt$ by keeping a rolling 10-minute history of $Bz$ values and calculating the slope.

**Better Alternative:**
- Use the **Newell Coupling Parameter** formula ($d\Phi/dt = V^{4/3} * B_t^{2/3} * \sin^8(\theta_c/2)$) which combines Solar Wind Speed, Total Magnetic Field ($Bt$), and Clock Angle ($\theta_c$).
- This provides a much more physically rigorous trigger for substorm onset than $Bz$ alone.

## 4. Meteorological APIs
**Current Implementation:**
We use `Open-Meteo`, which provides excellent free data for high/mid/low cloud cover layers.

**Better Alternative:**
- Integrate **Astrospheric API** or **Meteoblue Astronomy API**. These APIs provide highly specialized astrophotography metrics such as "Astronomical Seeing" (atmospheric turbulence/scintillation) and "Transparency", which are critical for capturing sharp aurora pillars.
