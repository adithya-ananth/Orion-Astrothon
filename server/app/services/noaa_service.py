"""
NOAA Space Weather Prediction Center data service.
Polls NOAA SWPC endpoints and caches results in memory.
"""

import logging
import time

import httpx

from app.utils.constants import (
    MAG_STALE_S,
    NOAA_ALERTS_URL,
    NOAA_FORECAST_URL,
    NOAA_KP_URL,
    NOAA_MAG_URL,
    NOAA_OVATION_URL,
    NOAA_PLASMA_URL,
    OVATION_STALE_S,
    PLASMA_STALE_S,
)

logger = logging.getLogger(__name__)

# In-memory cache
_cache: dict = {
    "mag": {"data": None, "timestamp": 0, "stale": True, "source": None},
    "plasma": {"data": None, "timestamp": 0, "stale": True},
    "ovation": {"data": None, "timestamp": 0, "stale": True},
    "kp": {"data": None, "timestamp": 0},
    "forecast": {"data": None, "timestamp": 0},
    "alerts": {"data": None, "timestamp": 0},
}


async def _fetch_json(url: str, timeout: float = 10.0):
    """Generic fetch helper with timeout and error handling."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.json()


def _has_mag_gaps(data) -> bool:
    """Check whether mag data contains gaps (null Bz values in recent entries)."""
    if not isinstance(data, list) or len(data) < 3:
        return True
    recent = data[-5:]
    return any(row[3] is None or row[3] == "" for row in recent)


async def fetch_mag_data() -> dict:
    """
    Fetch 1-day magnetometer (IMF) data.
    Implements DSCOVR→ACE failover: NOAA's mag endpoint automatically serves
    the best available data source (DSCOVR primary, ACE backup). When gaps are
    detected we re-fetch to pick up any newly available ACE backfill, and flag
    the source as ACE_FAILOVER so downstream consumers know data provenance.
    """
    try:
        data = await _fetch_json(NOAA_MAG_URL)
        source = "DSCOVR"

        if _has_mag_gaps(data):
            data = await _fetch_json(NOAA_MAG_URL)
            source = "ACE_FAILOVER"

        _cache["mag"] = {
            "data": data,
            "source": source,
            "timestamp": time.time(),
            "stale": False,
        }
        return _cache["mag"]
    except Exception as exc:
        logger.error("fetch_mag_data error: %s", exc)
        if _cache["mag"]["data"]:
            _cache["mag"]["stale"] = True
        return _cache["mag"]


async def fetch_plasma_data() -> dict:
    """Fetch 1-day solar wind plasma data (speed, density, temperature)."""
    try:
        data = await _fetch_json(NOAA_PLASMA_URL)
        _cache["plasma"] = {"data": data, "timestamp": time.time(), "stale": False}
        return _cache["plasma"]
    except Exception as exc:
        logger.error("fetch_plasma_data error: %s", exc)
        if _cache["plasma"]["data"]:
            _cache["plasma"]["stale"] = True
        return _cache["plasma"]


async def fetch_ovation_data() -> dict:
    """Fetch latest OVATION aurora probability grid (360×181)."""
    try:
        data = await _fetch_json(NOAA_OVATION_URL)
        _cache["ovation"] = {"data": data, "timestamp": time.time(), "stale": False}
        return _cache["ovation"]
    except Exception as exc:
        logger.error("fetch_ovation_data error: %s", exc)
        if _cache["ovation"]["data"]:
            _cache["ovation"]["stale"] = True
        return _cache["ovation"]


async def fetch_kp_index() -> dict:
    """Fetch planetary Kp index."""
    try:
        data = await _fetch_json(NOAA_KP_URL)
        _cache["kp"] = {"data": data, "timestamp": time.time()}
        return _cache["kp"]
    except Exception as exc:
        logger.error("fetch_kp_index error: %s", exc)
        return _cache["kp"]


async def fetch_forecast() -> dict:
    """Fetch 3-day forecast."""
    try:
        data = await _fetch_json(NOAA_FORECAST_URL)
        _cache["forecast"] = {"data": data, "timestamp": time.time()}
        return _cache["forecast"]
    except Exception as exc:
        logger.error("fetch_forecast error: %s", exc)
        return _cache["forecast"]


async def fetch_alerts() -> dict:
    """Fetch NOAA space weather alerts."""
    try:
        data = await _fetch_json(NOAA_ALERTS_URL)
        _cache["alerts"] = {"data": data, "timestamp": time.time()}
        return _cache["alerts"]
    except Exception as exc:
        logger.error("fetch_alerts error: %s", exc)
        return _cache["alerts"]


def _update_staleness():
    """Update staleness flags based on elapsed time."""
    now = time.time()
    if _cache["mag"]["timestamp"] and now - _cache["mag"]["timestamp"] > MAG_STALE_S:
        _cache["mag"]["stale"] = True
    if _cache["plasma"]["timestamp"] and now - _cache["plasma"]["timestamp"] > PLASMA_STALE_S:
        _cache["plasma"]["stale"] = True
    if _cache["ovation"]["timestamp"] and now - _cache["ovation"]["timestamp"] > OVATION_STALE_S:
        _cache["ovation"]["stale"] = True


def get_cache() -> dict:
    """Get the full cache (read-only snapshot)."""
    _update_staleness()
    return {**_cache}
