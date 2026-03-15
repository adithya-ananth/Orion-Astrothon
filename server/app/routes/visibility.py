"""Visibility score routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.services import noaa_service, visibility_service, weather_service

router = APIRouter(prefix="/api/visibility", tags=["visibility"])


@router.get("/score")
async def get_score(lat: float = Query(...), lon: float = Query(...)):
    try:
        cache = noaa_service.get_cache()
        cloud_data = await weather_service.fetch_cloud_cover(lat, lon)
        darkness_score = visibility_service.get_darkness_score(lat, lon, datetime.now(timezone.utc))

        result = visibility_service.compute_visibility_score(
            lat, lon,
            cache["ovation"]["data"],
            cloud_data,
            darkness_score,
        )

        return {"status": "ok", "data": {"lat": lat, "lon": lon, **result}}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/magnetic-midnight")
def get_magnetic_midnight(lat: float = Query(...), lon: float = Query(...)):
    try:
        result = visibility_service.get_magnetic_midnight(lat, lon, datetime.now(timezone.utc))
        return {"status": "ok", "data": {"lat": lat, "lon": lon, **result}}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
