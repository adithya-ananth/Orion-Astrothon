"""
Hyper-Local Aurora Forecasting Platform — FastAPI Server
"""

import asyncio
import logging
import os
import time

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.services import noaa_service, notification_service, visibility_service, weather_service
from app.routes import solar_wind, ovation, visibility, forecast, alerts, photography, notifications

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PORT = int(os.environ.get("PORT", 5000))
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:3000")

# Background task handle
_scheduler_task: asyncio.Task | None = None
_start_time: float = 0


async def _poll_mag_plasma():
    """Fetch mag + plasma data."""
    await asyncio.gather(
        noaa_service.fetch_mag_data(),
        noaa_service.fetch_plasma_data(),
    )


async def _poll_ovation():
    """Fetch OVATION data."""
    await noaa_service.fetch_ovation_data()


async def _poll_kp_forecast_alerts():
    """Fetch Kp, forecast, and alerts."""
    await asyncio.gather(
        noaa_service.fetch_kp_index(),
        noaa_service.fetch_forecast(),
        noaa_service.fetch_alerts(),
    )


def _compute_score_for_location(lat: float, lon: float) -> float:
    """Compute the current composite visibility score for a location.

    Used by the notification background loop to evaluate each subscriber's
    threshold.  Uses cached OVATION data (no network call) but falls back
    to a simple aurora-only score when weather data is unavailable (since
    we cannot ``await`` inside this sync helper).
    """
    from datetime import datetime, timezone as _tz

    cache = noaa_service.get_cache()
    ovation_data = cache["ovation"]["data"]

    now = datetime.now(_tz.utc)
    darkness = visibility_service.get_darkness_score(lat, lon, now)
    aurora = visibility_service.get_aurora_probability(lat, lon, ovation_data)

    # Lightweight composite: aurora 50% + darkness 15%, cloud assumed moderate (50)
    cloud_score = 50.0
    score = aurora * 0.50 + cloud_score * 0.35 + darkness * 0.15
    return max(0, min(100, score))


def _run_notification_checks():
    """Run notification checks for all subscribers."""
    events = notification_service.check_and_notify(_compute_score_for_location)
    if events:
        logger.info("[notifications] %d event(s): %s", len(events), events)


async def _scheduler_loop():
    """Background loop to poll NOAA endpoints at different cadences."""
    try:
        # Initial wait to let server start
        await asyncio.sleep(2)
        
        # Immediate first fetch for vital data
        logger.info("Performing initial data fetch...")
        await _poll_mag_plasma()
        await _poll_ovation()
        await _poll_kp_forecast_alerts()
        logger.info("Initial fetch complete.")
    except Exception as e:
        logger.error(f"Initial fetch failed: {e}")

    mag_plasma_interval = 60      # 1 minute
    ovation_interval = 300        # 5 minutes
    kp_forecast_interval = 1800   # 30 minutes
    notification_interval = 300   # 5 minutes

    last_mag_plasma = time.time()
    last_ovation = time.time()
    last_kp_forecast = time.time()
    last_notification = time.time()

    while True:
        try:
            now = time.time()

            # Using >= allows simple check
            if now - last_mag_plasma >= mag_plasma_interval:
                logger.debug("Polling Mag/Plasma...")
                try:
                    await _poll_mag_plasma()
                except Exception as exc:
                    logger.error("[cron] mag/plasma fetch error: %s", exc)
                last_mag_plasma = time.time()

            if now - last_ovation >= ovation_interval:
                logger.debug("Polling Ovation...")
                try:
                    await _poll_ovation()
                except Exception as exc:
                    logger.error("[cron] OVATION fetch error: %s", exc)
                last_ovation = time.time()

            if now - last_kp_forecast >= kp_forecast_interval:
                logger.debug("Polling Kp/Forecast...")
                try:
                    await _poll_kp_forecast_alerts()
                except Exception as exc:
                    logger.error("[cron] Kp/forecast fetch error: %s", exc)
                last_kp_forecast = time.time()

            if now - last_notification >= notification_interval:
                logger.debug("Checking notification subscribers...")
                try:
                    _run_notification_checks()
                except Exception as exc:
                    logger.error("[cron] notification check error: %s", exc)
                last_notification = time.time()

            await asyncio.sleep(10)  # Sleep small amount to not inherit busy loop
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start and stop background polling."""
    global _scheduler_task, _start_time
    _start_time = time.time()

    logger.info("[server] Performing initial data fetch...")
    try:
        await asyncio.gather(
            noaa_service.fetch_mag_data(),
            noaa_service.fetch_plasma_data(),
            noaa_service.fetch_ovation_data(),
            noaa_service.fetch_kp_index(),
            noaa_service.fetch_forecast(),
            noaa_service.fetch_alerts(),
        )
        logger.info("[server] Initial data fetch complete")
    except Exception as exc:
        logger.error("[server] Initial data fetch error: %s", exc)

    _scheduler_task = asyncio.create_task(_scheduler_loop())

    yield

    logger.info("[server] Shutting down gracefully...")
    if _scheduler_task:
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Aurora Forecast API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(solar_wind.router)
app.include_router(ovation.router)
app.include_router(visibility.router)
app.include_router(forecast.router)
app.include_router(alerts.router)
app.include_router(photography.router)
app.include_router(notifications.router)


@app.get("/api/health")
def health():
    cache = noaa_service.get_cache()
    return {
        "status": "ok",
        "uptime": time.time() - _start_time,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "dataStatus": {
            "mag": {"fresh": not cache["mag"]["stale"], "lastUpdate": cache["mag"]["timestamp"] or None},
            "plasma": {"fresh": not cache["plasma"]["stale"], "lastUpdate": cache["plasma"]["timestamp"] or None},
            "ovation": {"fresh": not cache["ovation"]["stale"], "lastUpdate": cache["ovation"]["timestamp"] or None},
            "kp": {"lastUpdate": cache["kp"]["timestamp"] or None},
            "forecast": {"lastUpdate": cache["forecast"]["timestamp"] or None},
        },
    }


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"status": "error", "message": "Route not found"},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error("[server] Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn
    logger.info(f"[server] Aurora Forecast API running on port {PORT}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, log_level="info")
