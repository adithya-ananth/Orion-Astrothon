import math
import httpx
import logging
from datetime import datetime
import ephem

logger = logging.getLogger("VisibilityScore")

# OVATION grid interpolation
def get_aurora_probability(lat, lon, ovation_data):
    if not ovation_data:
        return 0

    # ovation_data has structure: { "Observation Time": "...", "Forecast Time": "...", "Data Format": [...], "coordinates": [[lon, lat, value], ...] }
    coords = ovation_data.get("coordinates", [])
    if not coords:
        return 0

    # The grid is 360x181. Lon is 0 to 359, Lat is -90 to 90
    lon_normalized = int(round(lon)) % 360
    lat_normalized = int(round(lat))

    # Fast exact match since it's an integer grid
    # If it's sorted by lon, lat or lat, lon, we can calculate index
    # But for safety, simple linear search
    closest_val = 0
    min_dist = float('inf')

    for pt in coords:
        p_lon, p_lat, p_val = pt
        d_lon = min(abs(p_lon - lon_normalized), 360 - abs(p_lon - lon_normalized))
        d_lat = abs(p_lat - lat_normalized)
        dist = math.sqrt(d_lon**2 + d_lat**2)
        if dist < min_dist:
            min_dist = dist
            closest_val = p_val
            if dist == 0:
                break

    return closest_val

async def get_cloud_cover(lat, lon):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=cloud_cover_low,cloud_cover_mid,cloud_cover_high"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current", {})
                low = current.get("cloud_cover_low", 0)
                mid = current.get("cloud_cover_mid", 0)
                high = current.get("cloud_cover_high", 0)

                # Weighted cloud penalty: low stratus obscures more than high cirrus
                weighted_cloud = (low * 0.6) + (mid * 0.3) + (high * 0.1)
                return min(weighted_cloud, 100.0)
        except Exception as e:
            logger.error(f"Error fetching open-meteo: {e}")
    return 50.0  # fallback

def calculate_darkness(lat, lon):
    observer = ephem.Observer()
    observer.lat = str(lat)
    observer.lon = str(lon)
    observer.date = datetime.utcnow()

    sun = ephem.Sun()
    sun.compute(observer)
    sun_alt = math.degrees(sun.alt)

    moon = ephem.Moon()
    moon.compute(observer)
    moon_alt = math.degrees(moon.alt)
    moon_phase = moon.phase / 100.0  # 0 to 1

    # 1. Sun Penalty
    if sun_alt > -18:
        if sun_alt > 0:
            sun_darkness = 0.0
        else:
            sun_darkness = (abs(sun_alt) / 18.0) * 100.0
    else:
        sun_darkness = 100.0

    # 2. Moon Penalty
    if moon_alt > 0 and sun_alt <= 0:
        moon_penalty = (moon_alt / 90.0) * moon_phase * 100.0
    else:
        moon_penalty = 0.0

    # 3. Bortle approximation (simple baseline)
    bortle_score = 70.0

    if sun_darkness == 0:
        return 0.0

    darkness_score = min(max((sun_darkness * 0.5) + ((100 - moon_penalty) * 0.3) + (bortle_score * 0.2), 0), 100)
    return darkness_score

async def compute_visibility_score(lat, lon, ovation_data):
    # D3: 50% Aurora Prob, 35% Cloud Cover, 15% Darkness
    aurora_prob = get_aurora_probability(lat, lon, ovation_data)
    cloud_cover = await get_cloud_cover(lat, lon)
    darkness = calculate_darkness(lat, lon)

    cloud_score = 100.0 - cloud_cover # inverted, 0 cloud = 100 score

    aurora_score = min(max(aurora_prob, 0), 100)

    composite = (aurora_score * 0.50) + (cloud_score * 0.35) + (darkness * 0.15)

    return {
        "score": round(composite, 2),
        "aurora_probability": round(aurora_score, 2),
        "cloud_cover": round(cloud_cover, 2),
        "darkness": round(darkness, 2)
    }
