import asyncio
import httpx
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DataPipeline")

# NOAA SWPC Endpoints
NOAA_MAG_1_DAY = "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json"
NOAA_PLASMA_1_DAY = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json"
NOAA_OVATION = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"

# In-memory store for the latest data
current_data = {
    "bz": None,
    "speed": None,
    "bz_rate": 0.0,
    "last_updated": None,
    "ovation": None
}

# Keep history for rate calculation
bz_history = []

async def fetch_json(url):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return None

def process_mag_data(data):
    if not data or len(data) < 2:
        return None

    headers = data[0]
    try:
        bz_idx = headers.index("bz_gsm")
        time_idx = headers.index("time_tag")
    except ValueError:
        logger.error("Could not find bz_gsm or time_tag in mag data headers")
        return None

    # Find the latest valid entry
    for row in reversed(data[1:]):
        try:
            if row[bz_idx] is not None:
                bz = float(row[bz_idx])
                time_tag = row[time_idx]
                return {"time_tag": time_tag, "bz": bz}
        except (ValueError, TypeError):
            continue
    return None

def process_plasma_data(data):
    if not data or len(data) < 2:
        return None

    headers = data[0]
    try:
        speed_idx = headers.index("speed")
        time_idx = headers.index("time_tag")
    except ValueError:
        logger.error("Could not find speed or time_tag in plasma data headers")
        return None

    for row in reversed(data[1:]):
        try:
            if row[speed_idx] is not None:
                speed = float(row[speed_idx])
                time_tag = row[time_idx]
                return {"time_tag": time_tag, "speed": speed}
        except (ValueError, TypeError):
            continue
    return None

async def poll_solar_wind():
    logger.info("Polling solar wind data...")
    mag_data = await fetch_json(NOAA_MAG_1_DAY)
    plasma_data = await fetch_json(NOAA_PLASMA_1_DAY)

    latest_mag = process_mag_data(mag_data)
    latest_plasma = process_plasma_data(plasma_data)

    if latest_mag:
        current_data["bz"] = latest_mag["bz"]
        now = datetime.utcnow()
        bz_history.append((now, latest_mag["bz"]))

        while bz_history and (now - bz_history[0][0]).total_seconds() > 600:
            bz_history.pop(0)

        if len(bz_history) >= 2:
            dt_min = (bz_history[-1][0] - bz_history[0][0]).total_seconds() / 60.0
            if dt_min > 0:
                current_data["bz_rate"] = (bz_history[-1][1] - bz_history[0][1]) / dt_min
            else:
                current_data["bz_rate"] = 0.0

    if latest_plasma:
        current_data["speed"] = latest_plasma["speed"]

    current_data["last_updated"] = datetime.utcnow().isoformat()
    logger.info(f"Updated Solar Wind: Bz={current_data['bz']}, Speed={current_data['speed']}, Rate={current_data.get('bz_rate', 0)}")

async def poll_ovation():
    logger.info("Polling OVATION data...")
    ovation_data = await fetch_json(NOAA_OVATION)
    if ovation_data:
        current_data["ovation"] = ovation_data
        logger.info("Updated OVATION grid.")

async def start_polling():
    while True:
        try:
            await asyncio.sleep(60)
            await poll_solar_wind()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in poll_solar_wind task: {e}")

async def start_ovation_polling():
    while True:
        try:
            await asyncio.sleep(1800)
            await poll_ovation()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in poll_ovation task: {e}")
