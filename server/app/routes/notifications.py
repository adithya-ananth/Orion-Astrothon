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
    """
    Register/Update for email alerts when visibility score exceeds *threshold*.
    Immediately checks if the new threshold is met and triggers notification if needed.
    """
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
        
        # Trigger an immediate check for this subscriber!
        # Importing main helper is cyclical, so we define a local helper or access service directly.
        # However, `notification_service.check_and_notify` iterates ALL subscribers.
        # For efficiency we might want a single-check function, but reusing the loop is acceptable
        # given the low expected volume for this hackathon project, or we can just let the
        # background loop pick it up (user asked for live update though).
        
        # To support "live update", we should check immediately.
        # We need the score computation logic. 
        # Since logic is in main.py (to avoid circular deps between services), we can't easily import it here without refactoring.
        # STRATEGY: Move `_compute_score_for_location` to `visibility_service` to allow shared use.
        
        from app.services import visibility_service, noaa_service
        from datetime import datetime, timezone
        
        def compute_score(lat, lon):
            cache = noaa_service.get_cache()
            ovation_data = cache["ovation"]["data"]
            now = datetime.now(timezone.utc)
            darkness = visibility_service.get_darkness_score(lat, lon, now)
            aurora = visibility_service.get_aurora_probability(lat, lon, ovation_data)
            cloud_score = 50.0 # Default fallback
            score = aurora * 0.50 + cloud_score * 0.35 + darkness * 0.15
            return max(0, min(100, score))

        # Run check just for this subscriber's effect (via full check to keep state consistent)
        notification_service.check_and_notify(compute_score)

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
