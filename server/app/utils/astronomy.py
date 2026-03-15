"""
Pure astronomical math functions.
"""

import math
from datetime import datetime, timezone

DEG = math.pi / 180
RAD = 180 / math.pi


def to_julian_date(dt: datetime) -> float:
    """Julian Date from a Python datetime object (must be UTC)."""
    timestamp_ms = dt.timestamp() * 1000
    return timestamp_ms / 86400000 + 2440587.5


def julian_centuries(dt: datetime) -> float:
    """Julian centuries since J2000.0."""
    jd = to_julian_date(dt)
    return (jd - 2451545.0) / 36525.0


def normalize_deg(deg: float) -> float:
    """Normalize angle to [0, 360)."""
    return ((deg % 360) + 360) % 360


def solar_position(lat: float, lon: float, dt: datetime) -> dict:
    """
    Solar position (altitude, azimuth) for a given latitude, longitude, and datetime.
    Uses simplified astronomical formulas.
    """
    T = julian_centuries(dt)

    # Mean longitude of the sun (degrees)
    L0 = normalize_deg(280.46646 + 36000.76983 * T + 0.0003032 * T * T)
    # Mean anomaly (degrees)
    M = normalize_deg(357.52911 + 35999.05029 * T - 0.0001537 * T * T)
    Mrad = M * DEG

    # Equation of center
    C = (
        (1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(Mrad)
        + (0.019993 - 0.000101 * T) * math.sin(2 * Mrad)
        + 0.000289 * math.sin(3 * Mrad)
    )

    # Sun's true longitude
    sun_lon = L0 + C

    # Obliquity of the ecliptic
    obliquity = 23.439291 - 0.0130042 * T
    obl_rad = obliquity * DEG
    sun_lon_rad = sun_lon * DEG

    # Right ascension and declination
    sin_dec = math.sin(obl_rad) * math.sin(sun_lon_rad)
    declination = math.asin(sin_dec) * RAD
    ra = math.atan2(
        math.cos(obl_rad) * math.sin(sun_lon_rad),
        math.cos(sun_lon_rad),
    ) * RAD

    # Greenwich Mean Sidereal Time
    jd = to_julian_date(dt)
    D = jd - 2451545.0
    GMST = normalize_deg(280.46061837 + 360.98564736629 * D)
    LST = normalize_deg(GMST + lon)

    # Hour angle
    HA = (LST - normalize_deg(ra)) * DEG

    lat_rad = lat * DEG
    dec_rad = declination * DEG

    # Altitude
    sin_alt = (
        math.sin(lat_rad) * math.sin(dec_rad)
        + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(HA)
    )
    altitude = math.asin(sin_alt) * RAD

    # Azimuth
    cos_az = (math.sin(dec_rad) - math.sin(lat_rad) * sin_alt) / (
        math.cos(lat_rad) * math.cos(math.asin(sin_alt))
    )
    azimuth = math.acos(max(-1, min(1, cos_az))) * RAD
    if math.sin(HA) > 0:
        azimuth = 360 - azimuth

    return {"altitude": altitude, "azimuth": azimuth}


def lunar_position(lat: float, lon: float, dt: datetime) -> dict:
    """Approximate lunar position."""
    T = julian_centuries(dt)

    # Simplified lunar coordinates
    Lm = normalize_deg(218.3165 + 481267.8813 * T)  # mean longitude
    D = normalize_deg(297.8502 + 445267.1115 * T)    # mean elongation
    M = normalize_deg(357.5291 + 35999.0503 * T)     # sun mean anomaly
    Mm = normalize_deg(134.9634 + 477198.8676 * T)   # moon mean anomaly
    F = normalize_deg(93.2720 + 483202.0175 * T)     # argument of latitude

    # Ecliptic longitude (simplified)
    moon_lon = (
        Lm
        + 6.289 * math.sin(Mm * DEG)
        + 1.274 * math.sin((2 * D - Mm) * DEG)
        + 0.658 * math.sin(2 * D * DEG)
        + 0.214 * math.sin(2 * Mm * DEG)
        - 0.186 * math.sin(M * DEG)
    )

    # Ecliptic latitude (simplified)
    moon_lat = (
        5.128 * math.sin(F * DEG)
        + 0.281 * math.sin((Mm + F) * DEG)
        + 0.278 * math.sin((Mm - F) * DEG)
    )

    # Convert ecliptic to equatorial
    obliquity = 23.439291 - 0.0130042 * T
    obl_rad = obliquity * DEG
    lon_rad = moon_lon * DEG
    lat_ecl = moon_lat * DEG

    sin_dec = (
        math.sin(lat_ecl) * math.cos(obl_rad)
        + math.cos(lat_ecl) * math.sin(obl_rad) * math.sin(lon_rad)
    )
    declination = math.asin(sin_dec) * RAD
    ra = math.atan2(
        math.cos(lat_ecl) * math.sin(obl_rad) * math.cos(lon_rad)
        + math.sin(lat_ecl) * math.sin(obl_rad),
        math.cos(lat_ecl) * math.cos(lon_rad),
    )

    # Hour angle
    jd = to_julian_date(dt)
    Dd = jd - 2451545.0
    GMST = normalize_deg(280.46061837 + 360.98564736629 * Dd)
    LST = normalize_deg(GMST + lon)
    HA = (LST - normalize_deg(ra * RAD)) * DEG

    lat_rad = lat * DEG
    dec_rad = declination * DEG

    sin_alt = (
        math.sin(lat_rad) * math.sin(dec_rad)
        + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(HA)
    )
    altitude = math.asin(sin_alt) * RAD

    cos_az = (math.sin(dec_rad) - math.sin(lat_rad) * sin_alt) / (
        math.cos(lat_rad) * math.cos(math.asin(sin_alt))
    )
    azimuth = math.acos(max(-1, min(1, cos_az))) * RAD
    if math.sin(HA) > 0:
        azimuth = 360 - azimuth

    return {"altitude": altitude, "azimuth": azimuth}


def lunar_phase(dt: datetime) -> float:
    """Lunar phase: returns illumination fraction 0-1."""
    # Synodic month = 29.53059 days
    # Known new moon: Jan 6, 2000 18:14 UTC
    known_new_moon = datetime(2000, 1, 6, 18, 14, 0, tzinfo=timezone.utc)
    synodic_month = 29.53059
    days_since_new = (dt.timestamp() - known_new_moon.timestamp()) / 86400
    phase = ((days_since_new % synodic_month) + synodic_month) % synodic_month
    # Illumination fraction using cosine approximation
    return (1 - math.cos((phase / synodic_month) * 2 * math.pi)) / 2


def is_astronomical_twilight(lat: float, lon: float, dt: datetime) -> bool:
    """Returns True if the sun is more than 18° below the horizon."""
    pos = solar_position(lat, lon, dt)
    return pos["altitude"] < -18


def day_night_terminator(dt: datetime) -> list:
    """Compute day/night terminator line as a list of {lat, lon} dicts."""
    T = julian_centuries(dt)
    L0 = normalize_deg(280.46646 + 36000.76983 * T)
    M = normalize_deg(357.52911 + 35999.05029 * T)
    C = (
        (1.914602 - 0.004817 * T) * math.sin(M * DEG)
        + 0.019993 * math.sin(2 * M * DEG)
    )
    sun_lon = (L0 + C) * DEG
    obliquity = (23.439291 - 0.0130042 * T) * DEG
    declination = math.asin(math.sin(obliquity) * math.sin(sun_lon))

    jd = to_julian_date(dt)
    D = jd - 2451545.0
    GMST = normalize_deg(280.46061837 + 360.98564736629 * D)

    points = []
    for lon_deg in range(-180, 181, 2):
        HA = normalize_deg(GMST + lon_deg) * DEG
        tan_lat = -math.cos(HA) / math.tan(declination)
        lat_deg = math.atan(tan_lat) * RAD
        if -90 <= lat_deg <= 90:
            points.append({"lat": lat_deg, "lon": lon_deg})
    return points
