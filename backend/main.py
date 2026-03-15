from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
from datetime import datetime

from data_pipeline import start_polling, start_ovation_polling, current_data, poll_solar_wind, poll_ovation
from visibility_score import compute_visibility_score
from alerts import init_db, add_subscriber, trigger_email_alert
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# Global variables
clients = []

# Pydantic models
class LocationQuery(BaseModel):
    lat: float
    lon: float

class EmailSubscribe(BaseModel):
    email: str

# Background worker to evaluate thresholds
async def alert_worker():
    last_bz_alert = None
    last_substorm_alert = None

    while True:
        await asyncio.sleep(60)
        bz = current_data.get("bz")
        bz_rate = current_data.get("bz_rate", 0)

        alerts = []
        now = datetime.utcnow()

        # 1. Raw Bz alert (Bz < -7 nT)
        if bz is not None and bz < -7.0:
            if not last_bz_alert or (now - last_bz_alert).total_seconds() > 3600:
                alerts.append({
                    "type": "severe_bz",
                    "message": f"Raw Bz dropped to {bz} nT! Ideal conditions for aurora."
                })
                last_bz_alert = now
                await trigger_email_alert("Aurora Alert: Strong Southward Bz", f"Bz is at {bz} nT. Look up!")

        # 2. Substorm Early Warning (dBz/dt > 2 nT/min)
        if bz_rate is not None and abs(bz_rate) > 2.0:
             if not last_substorm_alert or (now - last_substorm_alert).total_seconds() > 1800:
                 alerts.append({
                     "type": "substorm_precursor",
                     "message": f"Rapid Bz change detected ({bz_rate:.2f} nT/min). Substorm conditions primed. Watch the sky now!"
                 })
                 last_substorm_alert = now
                 await trigger_email_alert("Substorm Precursor", f"Rapid Bz change detected ({bz_rate:.2f} nT/min).")

        if alerts:
            for client in clients:
                await client.put(json.dumps(alerts))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: trigger initial fetch and start background polling
    await init_db()
    asyncio.create_task(poll_solar_wind())
    asyncio.create_task(poll_ovation())

    polling_task = asyncio.create_task(start_polling())
    ovation_task = asyncio.create_task(start_ovation_polling())
    alert_task = asyncio.create_task(alert_worker())
    yield
    # Shutdown
    polling_task.cancel()
    ovation_task.cancel()
    alert_task.cancel()

app = FastAPI(title="Aurora Forecasting API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "message": "Aurora API is running",
        "bz": current_data["bz"],
        "speed": current_data["speed"],
        "last_updated": current_data["last_updated"]
    }

@app.get("/api/solar-wind")
def get_solar_wind():
    return {
        "bz": current_data["bz"],
        "speed": current_data["speed"],
        "bz_rate": current_data["bz_rate"],
        "last_updated": current_data["last_updated"]
    }

@app.get("/api/ovation")
def get_ovation():
    if not current_data.get("ovation"):
        return {"error": "Ovation data not yet loaded"}
    return current_data["ovation"]


@app.post("/api/visibility")
async def get_visibility(query: LocationQuery):
    if not current_data.get("ovation"):
        return {"error": "Ovation data not yet loaded"}

    score = await compute_visibility_score(query.lat, query.lon, current_data["ovation"])
    return score

@app.post("/api/subscribe")
async def subscribe_email(sub: EmailSubscribe):
    success = await add_subscriber(sub.email)
    if success:
        return {"message": "Successfully subscribed!"}
    return {"message": "Email already subscribed or error occurred."}

@app.get("/api/stream")
async def sse_stream(request: Request):
    queue = asyncio.Queue()
    clients.append(queue)

    async def event_generator():
        try:
            while True:
                # If client closes connection, break
                if await request.is_disconnected():
                    break

                try:
                    # Wait for message with timeout to periodically check disconnect
                    alerts_json = await asyncio.wait_for(queue.get(), timeout=10.0)
                    yield {
                        "event": "alert",
                        "data": alerts_json
                    }
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:
            pass
        finally:
            clients.remove(queue)

    return EventSourceResponse(event_generator())
