"""Forecast routes (Kp index and 3-day forecast)."""

from fastapi import APIRouter

from app.services import noaa_service

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/kp")
def get_kp():
    try:
        cache = noaa_service.get_cache()
        return {
            "status": "ok",
            "data": cache["kp"]["data"],
            "timestamp": cache["kp"]["timestamp"],
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/3day")
def get_3day():
    try:
        cache = noaa_service.get_cache()
        return {
            "status": "ok",
            "data": cache["forecast"]["data"],
            "timestamp": cache["forecast"]["timestamp"],
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
