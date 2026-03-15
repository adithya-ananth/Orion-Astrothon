"""OVATION aurora map data routes."""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services import noaa_service, solar_wind_service, visibility_service

router = APIRouter(prefix="/api/ovation", tags=["ovation"])


@router.get("/latest")
def get_latest():
    try:
        cache = noaa_service.get_cache()
        reliability = solar_wind_service.check_ovation_reliability()
        return {
            "status": "ok",
            "data": cache["ovation"]["data"],
            "timestamp": cache["ovation"]["timestamp"],
            "stale": cache["ovation"]["stale"],
            "ovationReliability": reliability,
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

        # Apply real-time Bz adjustment
        conditions = solar_wind_service.get_latest_conditions()
        bz = conditions.get("bz")
        adjusted = visibility_service.adjust_aurora_for_bz(probability, bz)

        reliability = solar_wind_service.check_ovation_reliability()

        return {
            "status": "ok",
            "data": {
                "lat": lat,
                "lon": lon,
                "probability": round(adjusted, 1),
                "rawProbability": round(probability, 1),
                "bzAdjusted": adjusted != probability,
                "currentBz": bz,
            },
            "timestamp": cache["ovation"]["timestamp"],
            "ovationReliability": reliability,
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
