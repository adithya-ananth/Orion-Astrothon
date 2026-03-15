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

from app.services import noaa_service
from app.routes import solar_wind, ovation, visibility, forecast, alerts, photography

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


async def _scheduler_loop():
    """Background loop to poll NOAA endpoints at different cadences."""
    mag_plasma_interval = 60      # 1 minute
    ovation_interval = 300        # 5 minutes
    kp_forecast_interval = 1800   # 30 minutes

    last_mag_plasma = 0.0
    last_ovation = 0.0
    last_kp_forecast = 0.0

    while True:
        now = time.time()

        if now - last_mag_plasma >= mag_plasma_interval:
            try:
                await _poll_mag_plasma()
            except Exception as exc:
                logger.error("[cron] mag/plasma fetch error: %s", exc)
            last_mag_plasma = time.time()

        if now - last_ovation >= ovation_interval:
            try:
                await _poll_ovation()
            except Exception as exc:
                logger.error("[cron] OVATION fetch error: %s", exc)
            last_ovation = time.time()

        if now - last_kp_forecast >= kp_forecast_interval:
            try:
                await _poll_kp_forecast_alerts()
            except Exception as exc:
                logger.error("[cron] Kp/forecast/alerts fetch error: %s", exc)
            last_kp_forecast = time.time()

        await asyncio.sleep(10)


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
