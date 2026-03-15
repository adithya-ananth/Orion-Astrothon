"""
Solar wind data processing service.
Computes derived quantities from raw NOAA solar wind data.
"""

import math
import time

from app.services import noaa_service
from app.utils.constants import (
    BZ_ALERT_THRESHOLD,
    BZ_HISTORY_MINUTES,
    L1_DISTANCE_KM,
    SPEED_ALERT_THRESHOLD,
    SUBSTORM_DBZ_RATE,
    SUBSTORM_SUSTAINED_MIN,
)

# Rolling 30-minute history of Bz values: {"timestamp": float, "bz": float}
_bz_history: list[dict] = []


def _trim_bz_history():
    """Trim Bz history to keep only the last BZ_HISTORY_MINUTES of data."""
    cutoff = time.time() - BZ_HISTORY_MINUTES * 60
    while _bz_history and _bz_history[0]["timestamp"] < cutoff:
        _bz_history.pop(0)


def record_bz(bz, timestamp=None):
    """Push a new Bz reading into the rolling history."""
    if bz is None or (isinstance(bz, float) and math.isnan(bz)):
        return
    _bz_history.append({"timestamp": timestamp or time.time(), "bz": float(bz)})
    _trim_bz_history()


def _safe_float(value):
    """Convert a value to float, returning None on failure."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def get_latest_conditions() -> dict:
    """Get the latest solar wind conditions from cached NOAA data."""
    cache = noaa_service.get_cache()

    bz = bx = by = bt = None
    speed = density = temperature = None

    # Parse mag data (header row + data rows)
    mag_data = cache["mag"]["data"]
    if mag_data and isinstance(mag_data, list) and len(mag_data) > 1:
        latest = mag_data[-1]
        # Columns: time_tag, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt
        bx = _safe_float(latest[1])
        by = _safe_float(latest[2])
        bz = _safe_float(latest[3])
        bt = _safe_float(latest[6])

        if bz is not None:
            record_bz(bz)

    # Parse plasma data
    plasma_data = cache["plasma"]["data"]
    if plasma_data and isinstance(plasma_data, list) and len(plasma_data) > 1:
        latest = plasma_data[-1]
        # Columns: time_tag, density, speed, temperature
        density = _safe_float(latest[1])
        speed = _safe_float(latest[2])
        temperature = _safe_float(latest[3])

    coupling = (
        compute_newell_coupling(bz, by, speed)
        if bz is not None and by is not None and speed is not None
        else None
    )

    delay = compute_propagation_delay(speed) if speed else None

    return {
        "bz": bz,
        "bx": bx,
        "by": by,
        "bt": bt,
        "speed": speed,
        "density": density,
        "temperature": temperature,
        "newellCoupling": coupling,
        "propagationDelay": delay,
        "magStale": cache["mag"]["stale"],
        "plasmaStale": cache["plasma"]["stale"],
        "magSource": cache["mag"].get("source"),
    }


def compute_newell_coupling(bz: float, by: float, speed: float) -> float:
    """
    Newell coupling function:
      dΦ/dt = v^(4/3) * Bt^(2/3) * sin^(8/3)(θ/2)
    where θ = atan2(|By|, Bz) is the IMF clock angle.
    |By| is used because the coupling function depends on the magnitude of the
    transverse component regardless of dawn/dusk orientation.
    """
    theta = math.atan2(abs(by), bz)
    Bt = math.sqrt(by * by + bz * bz)
    if Bt == 0 or speed <= 0:
        return 0

    sin_half_theta = math.sin(abs(theta) / 2)
    return (speed ** (4 / 3)) * (Bt ** (2 / 3)) * (sin_half_theta ** (8 / 3))


def compute_propagation_delay(speed) -> float | None:
    """Propagation delay from L1 to Earth in seconds."""
    if not speed or speed <= 0:
        return None
    return L1_DISTANCE_KM / speed


def check_bz_threshold(bz) -> dict | None:
    """Check Bz threshold alert."""
    if bz is None:
        return None
    if bz < BZ_ALERT_THRESHOLD:
        return {
            "type": "BZ_SOUTHWARD",
            "message": f"Bz is {bz:.1f} nT (threshold: {BZ_ALERT_THRESHOLD} nT)",
            "severity": "critical" if bz < BZ_ALERT_THRESHOLD * 2 else "warning",
            "value": bz,
        }
    return None


def check_speed_threshold(speed) -> dict | None:
    """Check solar wind speed threshold alert."""
    if speed is None:
        return None
    if speed > SPEED_ALERT_THRESHOLD:
        return {
            "type": "HIGH_SPEED",
            "message": f"Solar wind speed is {speed:.0f} km/s (threshold: {SPEED_ALERT_THRESHOLD} km/s)",
            "severity": "critical" if speed > SPEED_ALERT_THRESHOLD * 1.5 else "warning",
            "value": speed,
        }
    return None


def detect_substorm(history: list | None = None) -> dict | None:
    """
    Detect substorm precursor from Bz history.
    If dBz/dt > SUBSTORM_DBZ_RATE nT/min sustained for SUBSTORM_SUSTAINED_MIN minutes → alert.
    """
    bz_data = history if history is not None else _bz_history
    if len(bz_data) < 2:
        return None

    # Compute dBz/dt for consecutive pairs
    rates = []
    for i in range(1, len(bz_data)):
        dt_min = (bz_data[i]["timestamp"] - bz_data[i - 1]["timestamp"]) / 60
        if dt_min <= 0:
            continue
        d_bz = bz_data[i]["bz"] - bz_data[i - 1]["bz"]
        # Negative dBz = southward turning; track rate magnitude for southward only
        rate = abs(d_bz) / dt_min if d_bz < 0 else 0
        rates.append({"rate": rate, "timestamp": bz_data[i]["timestamp"]})

    # Check for sustained high rate
    sustained_s = SUBSTORM_SUSTAINED_MIN * 60
    streak_start = None

    for item in rates:
        if item["rate"] > SUBSTORM_DBZ_RATE:
            if streak_start is None:
                streak_start = item["timestamp"]
            if item["timestamp"] - streak_start >= sustained_s:
                return {
                    "type": "SUBSTORM_PRECURSOR",
                    "message": f"dBz/dt > {SUBSTORM_DBZ_RATE} nT/min sustained for {SUBSTORM_SUSTAINED_MIN}+ minutes",
                    "severity": "warning",
                    "duration": (item["timestamp"] - streak_start) / 60,
                }
        else:
            streak_start = None

    return None


def get_alerts() -> list:
    """Get all current alerts."""
    conditions = get_latest_conditions()
    alerts = []

    bz_alert = check_bz_threshold(conditions["bz"])
    if bz_alert:
        alerts.append(bz_alert)

    speed_alert = check_speed_threshold(conditions["speed"])
    if speed_alert:
        alerts.append(speed_alert)

    substorm_alert = detect_substorm()
    if substorm_alert:
        alerts.append(substorm_alert)

    return alerts


def check_ovation_reliability(history: list | None = None) -> dict:
    """
    Check whether OVATION data should be flagged as potentially unreliable.

    When |dBz/dt| > 2 nT/min, the IMF is changing faster than OVATION's
    ~30-minute refresh cadence can track.  In that case the static OVATION
    grid may significantly underestimate (or overestimate) real-time aurora
    probability.

    Returns a dict with ``reliable`` (bool) and, when unreliable, a
    ``reason`` string and the ``max_dbz_dt`` rate observed.
    """
    bz_data = history if history is not None else _bz_history
    if len(bz_data) < 2:
        return {"reliable": True}

    max_rate = 0.0
    for i in range(1, len(bz_data)):
        dt_min = (bz_data[i]["timestamp"] - bz_data[i - 1]["timestamp"]) / 60
        if dt_min <= 0:
            continue
        d_bz = abs(bz_data[i]["bz"] - bz_data[i - 1]["bz"])
        rate = d_bz / dt_min
        if rate > max_rate:
            max_rate = rate

    if max_rate > SUBSTORM_DBZ_RATE:
        return {
            "reliable": False,
            "reason": (
                f"|dBz/dt| = {max_rate:.1f} nT/min exceeds {SUBSTORM_DBZ_RATE} nT/min; "
                "OVATION may not reflect current conditions"
            ),
            "max_dbz_dt": round(max_rate, 2),
        }
    return {"reliable": True}
