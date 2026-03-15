"""Visibility score routes."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.services import noaa_service, visibility_service, weather_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/visibility", tags=["visibility"])


@router.get("/score")
async def get_score(lat: float = Query(...), lon: float = Query(...)):
    try:
        logger.info("[visibility] score request for lat=%.4f, lon=%.4f", lat, lon)

        cache = noaa_service.get_cache()
        ovation_data = cache["ovation"]["data"]
        ovation_stale = cache["ovation"].get("stale", True)
        logger.info(
            "[visibility] OVATION cache: has_data=%s, stale=%s, timestamp=%s",
            ovation_data is not None,
            ovation_stale,
            cache["ovation"]["timestamp"] or "never",
        )

        cloud_data = await weather_service.fetch_cloud_cover(lat, lon)
        logger.info("[visibility] cloud_data: %s", cloud_data)

        now = datetime.now(timezone.utc)
        darkness_score = visibility_service.get_darkness_score(lat, lon, now)
        logger.info("[visibility] darkness_score: %.2f (time=%s)", darkness_score, now.isoformat())

        result = visibility_service.compute_visibility_score(
            lat, lon,
            ovation_data,
            cloud_data,
            darkness_score,
        )
        logger.info("[visibility] result: %s", result)

        return {"status": "ok", "data": {"lat": lat, "lon": lon, **result}}
    except Exception as exc:
        logger.error("[visibility] score computation failed: %s", exc, exc_info=True)
        return {"status": "error", "message": str(exc)}


@router.get("/magnetic-midnight")
def get_magnetic_midnight(lat: float = Query(...), lon: float = Query(...)):
    try:
        result = visibility_service.get_magnetic_midnight(lat, lon, datetime.now(timezone.utc))
        return {"status": "ok", "data": {"lat": lat, "lon": lon, **result}}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
