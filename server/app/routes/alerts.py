"""Alert configuration and status routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from app.services import noaa_service, solar_wind_service, visibility_service

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# In-memory alert configurations
_alert_configs: list[dict] = []


@router.post("/configure")
def configure_alert(
    lat: float = Body(...),
    lon: float = Body(...),
    threshold: float = Body(50),
    email: str | None = Body(None),
):
    try:
        config = {
            "id": str(uuid.uuid4()),
            "lat": lat,
            "lon": lon,
            "threshold": threshold,
            "email": email,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        _alert_configs.append(config)
        return JSONResponse(status_code=201, content={"status": "ok", "data": config})
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/active")
def get_active():
    try:
        alerts = solar_wind_service.get_alerts()
        return {"status": "ok", "data": alerts}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/check")
def check_alerts(lat: float = Query(...), lon: float = Query(...)):
    try:
        solar_alerts = solar_wind_service.get_alerts()
        cache = noaa_service.get_cache()

        probability = visibility_service.get_aurora_probability(
            lat, lon, cache["ovation"]["data"]
        )
        location_alerts = list(solar_alerts)

        if probability > 50:
            location_alerts.append({
                "type": "AURORA_LIKELY",
                "message": f"Aurora probability at your location is {probability}%",
                "severity": "critical" if probability > 80 else "warning",
                "value": probability,
            })

        return {
            "status": "ok",
            "data": {
                "lat": lat,
                "lon": lon,
                "probability": probability,
                "alerts": location_alerts,
                "shouldNotify": len(location_alerts) > 0,
            },
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
