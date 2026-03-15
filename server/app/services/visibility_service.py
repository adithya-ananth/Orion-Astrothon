"""
Visibility scoring service.
Computes composite visibility scores for aurora observation.
"""

import logging
import math
from datetime import datetime, timezone

from app.utils.astronomy import lunar_phase, lunar_position, solar_position
from app.utils.constants import AURORA_WEIGHT, CLOUD_WEIGHT, DARKNESS_WEIGHT

logger = logging.getLogger(__name__)


def compute_visibility_score(lat, lon, ovation_data, cloud_data, darkness_data=None) -> dict:
    """
    Compute the composite visibility score (0-100).
    Weights: aurora 50%, cloud cover 35%, darkness 15%.
    """
    aurora = get_aurora_probability(lat, lon, ovation_data)
    cloud = get_cloud_score(cloud_data)
    darkness = darkness_data if darkness_data is not None else get_darkness_score(lat, lon, datetime.now(timezone.utc))

    logger.info(
        "[visibility_service] aurora=%.1f, cloud=%.1f, darkness=%.1f (weights: %.2f/%.2f/%.2f)",
        aurora, cloud, darkness, AURORA_WEIGHT, CLOUD_WEIGHT, DARKNESS_WEIGHT,
    )

    score = aurora * AURORA_WEIGHT + cloud * CLOUD_WEIGHT + darkness * DARKNESS_WEIGHT
    return {
        "composite": round(max(0, min(100, score))),
        "breakdown": {
            "aurora": round(aurora),
            "cloud": round(cloud),
            "darkness": round(darkness),
        },
        "weights": {
            "aurora": AURORA_WEIGHT,
            "cloud": CLOUD_WEIGHT,
            "darkness": DARKNESS_WEIGHT,
        },
    }


def get_aurora_probability(lat, lon, ovation_data) -> float:
    """
    Interpolate aurora probability from OVATION grid data.
    OVATION data is an array of {Longitude, Latitude, Aurora} objects.
    """
    if not ovation_data:
        return 0

    # Find the coordinates array (may be nested under a key)
    coords = ovation_data
    if isinstance(ovation_data, dict) and "coordinates" in ovation_data:
        coords = ovation_data["coordinates"]

    if not isinstance(coords, list) or len(coords) == 0:
        return 0

    # Normalize longitude to [0, 360)
    norm_lon = ((lon % 360) + 360) % 360

    min_dist = float("inf")
    nearest = 0

    for point in coords:
        if not isinstance(point, list) or len(point) < 3:
            continue
        
        # Format is [Longitude, Latitude, Aurora]
        try:
            p_lon = float(point[0])
            p_lat = float(point[1])
            aurora_val = float(point[2])
        except (ValueError, TypeError):
            continue

        d_lat = p_lat - lat
        d_lon = p_lon - norm_lon
        
        # Quick pre-filter before expensive dist calc
        if abs(d_lat) > 5 or abs(d_lon) > 5:
            continue

        dist = d_lat * d_lat + d_lon * d_lon
        if dist < min_dist:
            min_dist = dist
            nearest = aurora_val

    return max(0, min(100, nearest))


def get_cloud_score(cloud_data) -> float:
    """
    Compute cloud cover score.
    Low stratus weighted 2x vs high cirrus.
    Score = 100 - weighted cloud percentage.
    """
    if not cloud_data:
        return 50  # assume moderate if no data

    low = cloud_data.get("low")
    mid = cloud_data.get("mid")
    high = cloud_data.get("high")

    # If all cloud values are missing, return moderate assumption
    if low is None and mid is None and high is None:
        return 50

    low = low or 0
    mid = mid or 0
    high = high or 0

    # Weighted: low clouds weighted 2x
    weighted_pct = (low * 2 + mid * 1.5 + high * 0.5) / 4
    return max(0, min(100, 100 - weighted_pct))


def get_darkness_score(lat, lon, timestamp) -> float:
    """
    Compute darkness score (0-100).
    Combines sun altitude, moon altitude × phase, and approximate Bortle class.
    """
    if isinstance(timestamp, datetime):
        dt = timestamp
    else:
        dt = datetime.fromisoformat(str(timestamp))

    sun = solar_position(lat, lon, dt)
    moon = lunar_position(lat, lon, dt)
    moon_illum = lunar_phase(dt)

    score = 0.0

    # Sun contribution
    if sun["altitude"] < -18:
        score += 60  # astronomical twilight - full dark
    elif sun["altitude"] < -12:
        score += 40  # nautical twilight
    elif sun["altitude"] < -6:
        score += 20  # civil twilight
    elif sun["altitude"] < 0:
        score += 5   # sun just below horizon

    # Moon contribution (bright moon hurts)
    moon_penalty = moon_illum * 30 if moon["altitude"] > 0 else 0
    score -= moon_penalty

    # Bortle class estimate: assume rural (Bortle 4) baseline = 10 bonus
    score += 10

    return max(0, min(100, score))


def get_sun_altitude(lat, lon, timestamp) -> dict:
    """Get sun altitude at a location and time."""
    if isinstance(timestamp, datetime):
        dt = timestamp
    else:
        dt = datetime.fromisoformat(str(timestamp))
    return solar_position(lat, lon, dt)


def get_moon_illumination(timestamp) -> float:
    """Get moon illumination at a given time."""
    if isinstance(timestamp, datetime):
        dt = timestamp
    else:
        dt = datetime.fromisoformat(str(timestamp))
    return lunar_phase(dt)


def get_magnetic_midnight(lat, lon, timestamp) -> dict:
    """
    Estimate when magnetic midnight occurs for a given location.
    Magnetic midnight ≈ solar midnight + offset based on magnetic declination.
    """
    if isinstance(timestamp, datetime):
        dt = timestamp
    else:
        dt = datetime.fromisoformat(str(timestamp))

    # Approximate geomagnetic coordinates (IGRF dipole approximation)
    geomag_pole_lon = -72.6

    # Geomagnetic longitude offset
    d_lon = lon - geomag_pole_lon
    mlt_offset_hours = d_lon / 15

    # Solar midnight at the location
    solar_midnight_utc = 24 - (lon / 15)
    mag_midnight_utc = (solar_midnight_utc - mlt_offset_hours + 24) % 24

    # Build the date for magnetic midnight
    result_dt = dt.replace(
        hour=int(mag_midnight_utc),
        minute=round((mag_midnight_utc % 1) * 60),
        second=0,
        microsecond=0,
    )

    return {
        "magneticMidnightUTC": mag_midnight_utc,
        "timestamp": result_dt.isoformat(),
        "note": "Approximate magnetic midnight based on dipole geomagnetic model",
    }
