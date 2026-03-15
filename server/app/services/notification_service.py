"""
Email notification service.

Manages subscriber registrations and sends email alerts when visibility
scores breach configured thresholds.  Uses an anti-spam flag so that a
subscriber receives at most one email per breach cycle:

    score ≥ threshold, email_sent=False  → send email, set email_sent=True
    score ≥ threshold, email_sent=True   → skip (already notified)
    score < threshold, email_sent=True   → reset email_sent=False
    score ≥ threshold, email_sent=False  → send email again
"""

import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import dotenv

dotenv.load_dotenv()  # Load SMTP config from .env file if present
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory subscriber store.
# Each entry:
#   {
#       "id": str,
#       "lat": float,
#       "lon": float,
#       "email": str,
#       "threshold": float,
#       "email_sent": bool,     # anti-spam flag
#       "created_at": str,
#       "last_score": float | None,
#       "last_checked": str | None,
#       "last_notified": str | None,
#   }
# ---------------------------------------------------------------------------
_subscribers: list[dict] = []

# SMTP configuration — read from environment at import time so tests can
# override via monkeypatch / env-var fixtures.
SMTP_HOST = os.environ.get("SMTP_HOST", "")
try:
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
except (ValueError, TypeError):
    SMTP_PORT = 587
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)


# ---------------------------------------------------------------------------
# Subscriber management
# ---------------------------------------------------------------------------

def subscribe(lat: float, lon: float, email: str, threshold: float = 60) -> dict:
    """
    Add or update a notification subscriber.
    If email exists, updates location and threshold.
    Returns the subscriber record.
    """
    # Check if subscriber exists
    for sub in _subscribers:
        if sub["email"] == email:
            sub["lat"] = lat
            sub["lon"] = lon
            sub["threshold"] = threshold
            # Reset email_sent flag if threshold changed to allow re-trigger
            # (or we could keep it to prevent spam, but user likely wants to know if new threshold is met)
            sub["email_sent"] = False 
            logger.info("[notifications] updated subscriber %s for %s (threshold=%s)", sub["id"], email, threshold)
            return sub

    # Create new subscriber if not found
    sub = {
        "id": str(uuid.uuid4()),
        "lat": lat,
        "lon": lon,
        "email": email,
        "threshold": threshold,
        "email_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_score": None,
        "last_checked": None,
        "last_notified": None,
    }
    _subscribers.append(sub)
    logger.info("[notifications] new subscriber %s for %s (threshold=%s)", sub["id"], email, threshold)
    return sub


def unsubscribe(subscriber_id: str) -> bool:
    """Remove a subscriber by ID.  Returns True if found and removed."""
    for i, sub in enumerate(_subscribers):
        if sub["id"] == subscriber_id:
            _subscribers.pop(i)
            logger.info("[notifications] removed subscriber %s", subscriber_id)
            return True
    return False


def get_subscribers() -> list[dict]:
    """Return a shallow copy of the subscriber list."""
    return list(_subscribers)


def clear_subscribers() -> None:
    """Remove all subscribers (useful for testing)."""
    _subscribers.clear()


# ---------------------------------------------------------------------------
# Email delivery
# ---------------------------------------------------------------------------

def _build_email_body(sub: dict, score: float) -> str:
    """Build a plain-text email body for an alert."""
    return (
        f"Aurora Alert!\n\n"
        f"Your visibility score at ({sub['lat']:.2f}, {sub['lon']:.2f}) "
        f"has reached {score:.0f}, exceeding your threshold of {sub['threshold']:.0f}.\n\n"
        f"Check the Aurora Forecast dashboard for the latest conditions.\n\n"
        f"— Aurora Forecast Platform"
    )


def send_email(to: str, subject: str, body: str) -> bool:
    """
    Send an email via SMTP.

    Returns True on success, False on failure (logged but not raised so the
    background loop keeps running).
    """
    if not SMTP_HOST or not SMTP_USER:
        logger.warning("[notifications] SMTP not configured — skipping email to %s", to)
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        logger.info("[notifications] email sent to %s", to)
        return True
    except Exception as exc:
        logger.error("[notifications] email send failed for %s: %s", to, exc)
        return False


# ---------------------------------------------------------------------------
# Background check logic
# ---------------------------------------------------------------------------

def check_and_notify(compute_score_fn) -> list[dict]:
    """
    Iterate through all subscribers, compute their current visibility score,
    and send an email when the threshold is breached (respecting the anti-spam
    flag).

    ``compute_score_fn(lat, lon)`` must be a callable that returns a numeric
    visibility score (0-100) for the given location.

    Returns a list of notification events (for logging / testing).
    """
    events: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    for sub in _subscribers:
        try:
            score = compute_score_fn(sub["lat"], sub["lon"])
        except Exception as exc:
            logger.error(
                "[notifications] score computation failed for %s: %s",
                sub["id"], exc,
            )
            continue

        sub["last_score"] = score
        sub["last_checked"] = now

        if score >= sub["threshold"]:
            if not sub["email_sent"]:
                # First breach — send email and set flag
                subject = f"Aurora Alert — score {score:.0f} at your location"
                body = _build_email_body(sub, score)
                sent = send_email(sub["email"], subject, body)
                sub["email_sent"] = True
                sub["last_notified"] = now
                events.append({
                    "subscriber_id": sub["id"],
                    "email": sub["email"],
                    "score": score,
                    "threshold": sub["threshold"],
                    "action": "email_sent" if sent else "email_skipped",
                })
            # else: score still above threshold but already notified → skip
        else:
            if sub["email_sent"]:
                # Score dropped back below threshold → reset flag
                sub["email_sent"] = False
                events.append({
                    "subscriber_id": sub["id"],
                    "email": sub["email"],
                    "score": score,
                    "threshold": sub["threshold"],
                    "action": "flag_reset",
                })

    return events
