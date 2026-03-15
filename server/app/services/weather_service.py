"""
Weather data service.
Fetches cloud cover from Open-Meteo API with caching.
"""

import logging
import time

import httpx

from app.utils.constants import OPEN_METEO_BASE, WEATHER_CACHE_S

logger = logging.getLogger(__name__)

# Cache keyed by grid cell (0.5° resolution)
_weather_cache: dict = {}


def _grid_key(lat: float, lon: float) -> str:
    """Round coordinates to 0.5° grid cell."""
    g_lat = f"{round(lat * 2) / 2:.1f}"
    g_lon = f"{round(lon * 2) / 2:.1f}"
    return f"{g_lat},{g_lon}"


async def fetch_cloud_cover(lat: float, lon: float) -> dict:
    """
    Fetch cloud cover for a given latitude and longitude.
    Returns {"total", "low", "mid", "high"} cloud cover percentages.
    Caches per 0.5° grid cell for 15 minutes.
    """
    key = _grid_key(lat, lon)
    now = time.time()

    # Check cache
    if key in _weather_cache:
        cached = _weather_cache[key]
        if now - cached["timestamp"] < WEATHER_CACHE_S:
            return cached["data"]

    try:
        url = f"{OPEN_METEO_BASE}?latitude={lat}&longitude={lon}&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            resp.raise_for_status()
            json_data = resp.json()

        current = json_data.get("current", {})

        data = {
            "total": current.get("cloud_cover"),
            "low": current.get("cloud_cover_low"),
            "mid": current.get("cloud_cover_mid"),
            "high": current.get("cloud_cover_high"),
        }

        _weather_cache[key] = {"data": data, "timestamp": now}
        return data
    except Exception as exc:
        logger.error("fetch_cloud_cover error: %s", exc)
        # Return cached data if available (even if stale)
        if key in _weather_cache:
            return _weather_cache[key]["data"]
        return {"total": None, "low": None, "mid": None, "high": None}


def clear_cache():
    """Clear the weather cache (for testing)."""
    _weather_cache.clear()
