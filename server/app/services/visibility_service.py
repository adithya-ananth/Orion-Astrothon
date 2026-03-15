"""
Visibility scoring service.
Computes composite visibility scores for aurora observation.
"""

import logging
import math
from datetime import datetime, timezone

from app.utils.astronomy import lunar_phase, lunar_position, solar_position
from app.utils.constants import (
    AURORA_WEIGHT,
    BZ_AURORA_BOOST_FACTOR,
    BZ_AURORA_BOOST_THRESHOLD,
    CLOUD_WEIGHT,
    DARKNESS_WEIGHT,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# VIIRS-inspired light-pollution reference points.
# Each entry: (lat, lon, radiance_nW) where radiance approximates the VIIRS
# nighttime-lights value.  A higher radiance → higher Bortle class → less
# darkness bonus.  Only a representative sample of major urban areas is
# needed; any query location is assigned the radiance of the nearest
# reference point, with radiance decaying as 1/d² (inverse-square) to model
# the light-dome fall-off.
# ---------------------------------------------------------------------------
_VIIRS_REFERENCE_POINTS: list[tuple[float, float, float]] = [
    # (lat, lon, approx VIIRS radiance nW/cm²/sr)
    # --- Europe ---
    (51.51, -0.13, 150.0),   # London
    (48.86, 2.35, 130.0),    # Paris
    (52.52, 13.41, 110.0),   # Berlin
    (40.42, -3.70, 100.0),   # Madrid
    (41.90, 12.50, 105.0),   # Rome
    (55.95, -3.19, 60.0),    # Edinburgh
    (57.48, -4.22, 15.0),    # Inverness (rural Scotland)
    (53.48, -2.24, 120.0),   # Manchester
    (59.33, 18.07, 70.0),    # Stockholm
    (60.17, 24.94, 65.0),    # Helsinki
    (69.65, 18.96, 20.0),    # Tromsø (dark-sky area)
    # --- North America ---
    (40.71, -74.01, 170.0),  # New York
    (34.05, -118.24, 160.0), # Los Angeles
    (41.88, -87.63, 140.0),  # Chicago
    (45.50, -73.57, 100.0),  # Montreal
    (64.84, -147.72, 12.0),  # Fairbanks (dark-sky area)
    (61.22, -149.90, 35.0),  # Anchorage
    # --- Asia ---
    (35.68, 139.69, 180.0),  # Tokyo
    (39.90, 116.40, 160.0),  # Beijing
    (28.61, 77.21, 140.0),   # New Delhi
    # --- Oceania ---
    (-33.87, 151.21, 110.0), # Sydney
    (-36.85, 174.76, 80.0),  # Auckland
    # --- South America ---
    (-23.55, -46.63, 130.0), # São Paulo
    (-34.60, -58.38, 110.0), # Buenos Aires
]

# Background radiance for locations far from any reference point
_VIIRS_BACKGROUND_RADIANCE = 2.0  # nW — very dark sky

# Maximum influence radius in degrees (beyond this, reference has no effect)
_VIIRS_INFLUENCE_DEG = 5.0


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
    OVATION data is an array of [Longitude, Latitude, Aurora] lists
    or {Longitude, Latitude, Aurora} dicts.
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
        # Support both list [lon, lat, aurora] and dict formats
        try:
            if isinstance(point, dict):
                p_lon = float(point.get("Longitude", 0))
                p_lat = float(point.get("Latitude", 0))
                aurora_val = float(point.get("Aurora", 0))
            elif isinstance(point, list) and len(point) >= 3:
                p_lon = float(point[0])
                p_lat = float(point[1])
                aurora_val = float(point[2])
            else:
                continue
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


def adjust_aurora_for_bz(probability: float, bz) -> float:
    """
    Apply real-time Bz adjustment on top of raw OVATION probability.

    OVATION's 30-minute update cadence can miss rapid southward turnings.
    When instantaneous Bz is strongly negative (< -7 nT), boost the aurora
    probability to capture the increased likelihood between OVATION updates.

    Formula: if Bz < -7 nT → probability × (1 + (|Bz| - 7) × 0.05),
    clamped to [0, 100].
    """
    if bz is None or bz >= BZ_AURORA_BOOST_THRESHOLD:
        return probability
    boost = 1 + (abs(bz) - abs(BZ_AURORA_BOOST_THRESHOLD)) * BZ_AURORA_BOOST_FACTOR
    return max(0, min(100, probability * boost))


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


def estimate_bortle_class(lat: float, lon: float) -> int:
    """
    Estimate Bortle class (1-9) from VIIRS-inspired light-pollution reference data.

    Uses an inverse-square radiance decay model from known urban reference
    points.  The aggregate radiance at the query location is mapped to a
    Bortle class:

        radiance (nW)  →  Bortle class
        ≥ 100          →  8  (inner city)
        ≥ 50           →  7  (suburban/urban transition)
        ≥ 25           →  6  (bright suburban)
        ≥ 10           →  5  (suburban)
        ≥  5           →  4  (rural/suburban transition)
        ≥  2           →  3  (rural)
        ≥  0.5         →  2  (dark site)
        <  0.5         →  1  (excellent dark site)
    """
    aggregate_radiance = _VIIRS_BACKGROUND_RADIANCE

    for ref_lat, ref_lon, ref_rad in _VIIRS_REFERENCE_POINTS:
        d_lat = lat - ref_lat
        d_lon = lon - ref_lon
        dist_sq = d_lat * d_lat + d_lon * d_lon
        if dist_sq < 0.01:
            # Essentially on top of the reference point
            aggregate_radiance = max(aggregate_radiance, ref_rad)
        elif math.sqrt(dist_sq) <= _VIIRS_INFLUENCE_DEG:
            # Quartic decay (1/d⁴) models the steep skyglow fall-off
            contribution = ref_rad / (dist_sq * dist_sq)
            aggregate_radiance += contribution

    if aggregate_radiance >= 100:
        return 8
    if aggregate_radiance >= 50:
        return 7
    if aggregate_radiance >= 25:
        return 6
    if aggregate_radiance >= 10:
        return 5
    if aggregate_radiance >= 5:
        return 4
    if aggregate_radiance >= 2:
        return 3
    if aggregate_radiance >= 0.5:
        return 2
    return 1


def _bortle_to_darkness_bonus(bortle: int) -> float:
    """
    Convert Bortle class to a darkness bonus (0-20 pts).

    Lower Bortle class (darker skies) → higher bonus.
    """
    return max(0, min(20, (9 - bortle) * 2.5))


def get_darkness_score(lat, lon, timestamp) -> float:
    """
    Compute darkness score (0-100).
    Combines sun altitude, moon altitude × phase, and VIIRS-based Bortle class.
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

    # VIIRS-based Bortle class bonus (location-dependent)
    bortle = estimate_bortle_class(lat, lon)
    score += _bortle_to_darkness_bonus(bortle)

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
