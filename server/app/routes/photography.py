"""Photography settings recommendation routes."""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services import photography_service

router = APIRouter(prefix="/api/photography", tags=["photography"])


@router.get("/settings")
def get_settings(kp: float = Query(...)):
    if kp < 0 or kp > 9:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Kp index must be between 0 and 9"},
        )
    return {"status": "ok", "data": photography_service.get_recommended_settings(kp)}

