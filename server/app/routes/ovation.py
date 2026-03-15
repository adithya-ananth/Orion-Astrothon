"""OVATION aurora map data routes."""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services import noaa_service, visibility_service

router = APIRouter(prefix="/api/ovation", tags=["ovation"])


@router.get("/latest")
def get_latest():
    try:
        cache = noaa_service.get_cache()
        return {
            "status": "ok",
            "data": cache["ovation"]["data"],
            "timestamp": cache["ovation"]["timestamp"],
            "stale": cache["ovation"]["stale"],
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/probability")
def get_probability(lat: float = Query(...), lon: float = Query(...)):
    try:
        cache = noaa_service.get_cache()
        ovation_data = cache["ovation"]["data"]

        if not ovation_data:
            return JSONResponse(
                status_code=503,
                content={"status": "error", "message": "OVATION data not yet available"},
            )

        probability = visibility_service.get_aurora_probability(lat, lon, ovation_data)
        return {
            "status": "ok",
            "data": {"lat": lat, "lon": lon, "probability": probability},
            "timestamp": cache["ovation"]["timestamp"],
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
