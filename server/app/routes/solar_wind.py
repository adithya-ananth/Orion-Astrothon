"""Solar wind API routes."""

from fastapi import APIRouter

from app.services import noaa_service, solar_wind_service

router = APIRouter(prefix="/api/solar-wind", tags=["solar-wind"])


@router.get("/latest")
def get_latest():
    try:
        conditions = solar_wind_service.get_latest_conditions()
        return {"status": "ok", "data": conditions}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/history")
def get_history():
    try:
        cache = noaa_service.get_cache()
        return {
            "status": "ok",
            "data": {
                "mag": cache["mag"]["data"],
                "plasma": cache["plasma"]["data"],
                "magTimestamp": cache["mag"]["timestamp"],
                "plasmaTimestamp": cache["plasma"]["timestamp"],
                "magStale": cache["mag"]["stale"],
                "plasmaStale": cache["plasma"]["stale"],
            },
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/alerts")
def get_alerts():
    try:
        alerts = solar_wind_service.get_alerts()
        return {"status": "ok", "data": alerts}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
