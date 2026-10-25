from __future__ import annotations

import hmac
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.agent import ask_sili
from backend.config import ADMIN_PASSWORD
from backend.store import (
    delete_event,
    delete_faculty,
    delete_place,
    get_events,
    get_faculty,
    get_meta,
    get_places,
    get_timetable,
    knowledge_bundle,
    save_events,
    upsert_event,
    upsert_faculty,
    upsert_place,
)

router = APIRouter()


def _require_admin(authorization: Optional[str]) -> None:
    expected = ADMIN_PASSWORD
    supplied = ""
    if authorization and authorization.startswith("Bearer "):
        supplied = authorization[7:]
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Admin authentication required")


# ── Chat (SILI agent) ───────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="en", description="Reply language: en or hi")


class ChatResponse(BaseModel):
    reply: str
    action: Optional[dict[str, Any]] = None
    language: Optional[str] = None
    knowledge_updated_at: Optional[str] = None


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Please enter a campus-related question.")
    try:
        result = await ask_sili(message, language=request.language or "en")
        return ChatResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI service unavailable: {exc}",
        ) from exc


# ── Public read APIs ────────────────────────────────────

@router.get("/places")
async def list_places():
    return {"places": get_places()}


@router.get("/faculty")
async def list_faculty():
    return {"faculty": get_faculty()}


@router.get("/events")
async def list_events():
    return get_events()


@router.put("/events")
async def put_events_compat(payload: dict, authorization: Optional[str] = Header(None)):
    """Compatibility with DISHA client: PUT /api/events with Bearer admin password."""
    _require_admin(authorization)
    records = payload.get("updates") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise HTTPException(status_code=400, detail="Expected {updates: [...]}")
    return save_events(records)


@router.get("/timetable")
async def list_timetable():
    return get_timetable()


@router.get("/meta")
async def list_meta():
    return get_meta()


@router.get("/knowledge")
async def full_knowledge():
    """Live knowledge bundle used by SILI (for debugging / admin)."""
    return knowledge_bundle()


# ── Admin write APIs ────────────────────────────────────

class PlaceBody(BaseModel):
    id: Optional[str] = None
    name: str
    code: str = ""
    type: str = "facility"
    category: str = "facility"
    floor: Optional[int] = None
    floorTitle: str = ""
    building: str = "E-block"
    description: str = ""
    verified: bool = False


@router.post("/admin/places")
async def admin_upsert_place(body: PlaceBody, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    data = body.model_dump()
    if not data.get("id"):
        data["id"] = f"place-{uuid.uuid4().hex[:8]}"
    return upsert_place(data)


@router.delete("/admin/places/{place_id}")
async def admin_delete_place(place_id: str, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    if not delete_place(place_id):
        raise HTTPException(status_code=404, detail="Place not found")
    return {"ok": True}


class FacultyBody(BaseModel):
    id: Optional[str] = None
    name: str
    honorific: str = ""
    initials: str = ""
    subject: str = ""
    staffRoom: str = ""
    staffPlace: str = ""


@router.post("/admin/faculty")
async def admin_upsert_faculty(body: FacultyBody, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    data = body.model_dump()
    if not data.get("id"):
        data["id"] = f"t-{uuid.uuid4().hex[:6]}"
    return upsert_faculty(data)


@router.delete("/admin/faculty/{fid}")
async def admin_delete_faculty(fid: str, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    if not delete_faculty(fid):
        raise HTTPException(status_code=404, detail="Faculty not found")
    return {"ok": True}


class EventBody(BaseModel):
    id: Optional[str] = None
    title: str
    kind: str = "event"  # event | exam
    location: str = ""
    locationNote: str = ""
    locationPlaceId: str = ""
    locationCode: str = ""
    locationFloor: Optional[int] = None
    start: str = ""
    end: str = ""
    details: str = ""
    createdBy: str = "admin"


@router.post("/admin/events")
async def admin_upsert_event(body: EventBody, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    data = body.model_dump()
    data["kind"] = "exam" if data.get("kind") == "exam" else "event"
    if not data.get("id"):
        data["id"] = f"ev-{uuid.uuid4().hex[:8]}"
    return upsert_event(data)


@router.put("/admin/events")
async def admin_replace_events(payload: dict, authorization: Optional[str] = Header(None)):
    """Bulk replace events list (compatible with old DISHA client)."""
    _require_admin(authorization)
    records = payload.get("updates") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise HTTPException(status_code=400, detail="Expected {updates: [...]}")
    return save_events(records)


@router.delete("/admin/events/{eid}")
async def admin_delete_event(eid: str, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    return delete_event(eid)
