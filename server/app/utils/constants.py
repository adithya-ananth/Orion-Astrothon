"""
Application constants — all magic numbers in one place.
"""

# Solar wind alert thresholds
BZ_ALERT_THRESHOLD = -7        # nT
SPEED_ALERT_THRESHOLD = 500    # km/s

# Substorm detection
SUBSTORM_DBZ_RATE = 2          # nT/min
SUBSTORM_SUSTAINED_MIN = 5     # minutes

# OVATION grid dimensions
OVATION_LAT_BINS = 181
OVATION_LON_BINS = 360

# Visibility score weights
AURORA_WEIGHT = 0.50
CLOUD_WEIGHT = 0.35
DARKNESS_WEIGHT = 0.15

# Cache staleness thresholds (seconds)
MAG_STALE_S = 5 * 60           # 5 minutes
PLASMA_STALE_S = 5 * 60        # 5 minutes
OVATION_STALE_S = 45 * 60      # 45 minutes
WEATHER_CACHE_S = 15 * 60      # 15 minutes

# L1 to Earth distance (km)
L1_DISTANCE_KM = 1.5e6

# Rolling history window
BZ_HISTORY_MINUTES = 30

# NOAA SWPC endpoints
NOAA_MAG_URL = "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json"
NOAA_PLASMA_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json"
NOAA_OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
NOAA_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
NOAA_FORECAST_URL = "https://services.swpc.noaa.gov/products/3-day-forecast.json"
NOAA_ALERTS_URL = "https://services.swpc.noaa.gov/products/alerts.json"

# Open-Meteo
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
