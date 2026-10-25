"""Shared campus data store — single source of truth for map, admin, and SILI."""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.config import DATA_DIR

FILES = {
    "places": DATA_DIR / "places.json",
    "faculty": DATA_DIR / "faculty.json",
    "events": DATA_DIR / "events.json",
    "timetable": DATA_DIR / "timetable.json",
    "meta": DATA_DIR / "meta.json",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read(path: Path, default: Any) -> Any:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        _write(path, default)
        return default
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data
    except (OSError, json.JSONDecodeError):
        return default


def _write(path: Path, data: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="sou-", suffix=".json", dir=DATA_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


# ── Places ──────────────────────────────────────────────

def get_places() -> list[dict]:
    data = _read(FILES["places"], [])
    return data if isinstance(data, list) else []


def save_places(places: list[dict]) -> list[dict]:
    _write(FILES["places"], places)
    return places


def upsert_place(place: dict) -> dict:
    places = get_places()
    pid = str(place.get("id", "")).strip()
    if not pid:
        raise ValueError("place id required")
    for i, p in enumerate(places):
        if p.get("id") == pid:
            places[i] = {**p, **place, "id": pid}
            save_places(places)
            return places[i]
    places.append(place)
    save_places(places)
    return place


def delete_place(place_id: str) -> bool:
    places = get_places()
    new = [p for p in places if p.get("id") != place_id]
    if len(new) == len(places):
        return False
    save_places(new)
    return True


# ── Faculty ─────────────────────────────────────────────

def get_faculty() -> list[dict]:
    data = _read(FILES["faculty"], [])
    return data if isinstance(data, list) else []


def save_faculty(items: list[dict]) -> list[dict]:
    _write(FILES["faculty"], items)
    return items


def upsert_faculty(item: dict) -> dict:
    items = get_faculty()
    fid = str(item.get("id", "")).strip()
    if not fid:
        raise ValueError("faculty id required")
    for i, f in enumerate(items):
        if f.get("id") == fid:
            items[i] = {**f, **item, "id": fid}
            save_faculty(items)
            return items[i]
    items.append(item)
    save_faculty(items)
    return item


def delete_faculty(fid: str) -> bool:
    items = get_faculty()
    new = [f for f in items if f.get("id") != fid]
    if len(new) == len(items):
        return False
    save_faculty(new)
    return True


# ── Events / exams ──────────────────────────────────────

def get_events() -> dict:
    data = _read(FILES["events"], {"updatedAt": None, "updates": []})
    if isinstance(data, list):
        return {"updatedAt": None, "updates": data}
    if isinstance(data, dict) and isinstance(data.get("updates"), list):
        return data
    return {"updatedAt": None, "updates": []}


def save_events(updates: list[dict]) -> dict:
    payload = {"updatedAt": _now(), "updates": updates}
    _write(FILES["events"], payload)
    return payload


def upsert_event(event: dict) -> dict:
    store = get_events()
    eid = str(event.get("id", "")).strip()
    if not eid:
        raise ValueError("event id required")
    updates = store["updates"]
    for i, e in enumerate(updates):
        if e.get("id") == eid:
            updates[i] = {**e, **event, "id": eid}
            return save_events(updates)
    updates.append(event)
    return save_events(updates)


def delete_event(eid: str) -> dict:
    store = get_events()
    updates = [e for e in store["updates"] if e.get("id") != eid]
    return save_events(updates)


# ── Timetable & meta ────────────────────────────────────

def get_timetable() -> dict:
    data = _read(FILES["timetable"], {})
    return data if isinstance(data, dict) else {}


def get_meta() -> dict:
    data = _read(FILES["meta"], {})
    return data if isinstance(data, dict) else {}


def knowledge_bundle() -> dict:
    """Full live knowledge base for SILI — always fresh from disk."""
    places = get_places()
    faculty = get_faculty()
    events = get_events()
    timetable = get_timetable()
    meta = get_meta()

    place_index = {
        p["id"]: {
            "id": p.get("id"),
            "name": p.get("name"),
            "code": p.get("code") or "",
            "floor": p.get("floor"),
            "floorTitle": p.get("floorTitle"),
            "building": p.get("building"),
            "category": p.get("category"),
            "type": p.get("type"),
            "description": p.get("description", ""),
        }
        for p in places
        if p.get("id")
    }

    faculty_enriched = []
    for f in faculty:
        place = place_index.get(f.get("staffPlace") or "", {})
        faculty_enriched.append({
            **f,
            "placeName": place.get("name"),
            "placeFloor": place.get("floor"),
            "placeBuilding": place.get("building"),
            "placeCode": place.get("code") or f.get("staffRoom"),
        })

    return {
        "meta": meta,
        "places": list(place_index.values()),
        "faculty": faculty_enriched,
        "events": events.get("updates", []),
        "eventsUpdatedAt": events.get("updatedAt"),
        "timetable": timetable,
        "routeable_place_ids": [
            p["id"] for p in places
            if p.get("building") == "E-block" and p.get("floor") is not None
        ],
    }
