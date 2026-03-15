"""Notification subscription routes."""

import re
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/subscribe")
def subscribe(
    lat: float = Body(...),
    lon: float = Body(...),
    email: str = Body(...),
    threshold: float = Body(60),
):
    """Register for email alerts when visibility score exceeds *threshold*."""
    try:
        if not email or not _EMAIL_RE.match(email):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Valid email address required"},
            )
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "lat must be -90..90, lon must be -180..180"},
            )
        if not (0 <= threshold <= 100):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "threshold must be 0..100"},
            )

        sub = notification_service.subscribe(lat, lon, email, threshold)
        return JSONResponse(status_code=201, content={"status": "ok", "data": sub})
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.delete("/unsubscribe/{subscriber_id}")
def unsubscribe(subscriber_id: str):
    """Remove a notification subscription."""
    try:
        removed = notification_service.unsubscribe(subscriber_id)
        if not removed:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": "Subscriber not found"},
            )
        return {"status": "ok", "message": "Unsubscribed successfully"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/subscribers")
def list_subscribers():
    """List all registered notification subscribers."""
    try:
        subs = notification_service.get_subscribers()
        return {"status": "ok", "data": subs}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
