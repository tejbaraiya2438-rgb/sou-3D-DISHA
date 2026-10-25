"""SILI agent: formal campus assistant; map actions only when user asks to navigate."""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from backend.config import OLLAMA_API_KEY, OLLAMA_BASE_URL, OLLAMA_MODEL
from backend.store import knowledge_bundle

SYSTEM_PROMPT_EN = """
You are SILI (Silver Oak Intelligence), the official campus assistant for Silver Oak University (SOU), Ahmedabad.

ROLE:
You assist visitors, parents, and students with faculty information, room locations, campus events, examinations, and indoor wayfinding.

TONE:
- Formal, clear, and respectful.
- Address the user as "you" (or "aap" only if the reply language is Hindi).
- Avoid slang, casual fillers, and overly friendly phrases.
- Keep answers concise and suitable for being read aloud.

LANGUAGE:
- Reply ONLY in English for this conversation.
- Do not mix Hindi words into English replies.

FACTS:
- Use ONLY the live Campus Knowledge Base JSON provided below.
- Never invent room numbers, faculty names, event dates, or policies.
- If information is unavailable, state that clearly.

MAP ACTIONS:
- For questions about who someone is, what an event is, or general details: reply with text only. Do NOT emit @@ACTION@@.
- Emit @@ACTION@@ ONLY when the user explicitly requests a route, path, directions, map view, or navigation (e.g. "route to", "show on map", "take me to", "how do I reach").

Action formats (navigation requests only):

@@ACTION@@
{"type":"focus_place","place_id":"<id from knowledge base>"}
@@END@@

@@ACTION@@
{"type":"show_route","from_id":"main-entrance","to_id":"<destination place id>"}
@@END@@

@@ACTION@@
{"type":"open_map"}
@@END@@

Rules: use place ids from the knowledge base only; at most one ACTION block; default from_id is main-entrance.
"""

SYSTEM_PROMPT_HI = """
आप SILI (Silver Oak Intelligence) हैं — सिल्वर ओक यूनिवर्सिटी (SOU), अहमदाबाद की आधिकारिक कैंपस सहायक।

भूमिका:
आप आगंतुकों, अभिभावकों और छात्रों की सहायता करती हैं — संकाय जानकारी, कक्ष स्थान, कार्यक्रम, परीक्षाएँ, और कैंपस मार्गदर्शन।

भाषा और शैली:
- केवल औपचारिक हिंदी में उत्तर दें।
- उपयोगकर्ता को "आप" कहकर संबोधित करें।
- स्वयं के लिए स्त्रीलिंग रूप: "मैं बता सकती हूँ", "मैं सहायता करूँगी"।
- अनौपचारिक या स्लैंग भाषा का प्रयोग न करें।
- उत्तर संक्षिप्त रखें, ताकि आवाज़ में पढ़े जा सकें।

तथ्य:
- केवल नीचे दिए गए Campus Knowledge Base JSON का उपयोग करें।
- कमरा नंबर, संकाय नाम, तिथियाँ या नीतियाँ स्वयं न बनाएँ।
- जानकारी न होने पर स्पष्ट रूप से बताएँ।

मानचित्र क्रियाएँ:
- केवल जानकारी पूछने पर (कौन हैं, क्या कार्यक्रम है): केवल पाठ उत्तर। @@ACTION@@ न लिखें।
- @@ACTION@@ केवल तब जब उपयोगकर्ता स्पष्ट रूप से मार्ग, रूट, मैप, या "ले चलो" माँगे।

क्रिया प्रारूप (केवल नेविगेशन पर):

@@ACTION@@
{"type":"focus_place","place_id":"<id from knowledge base>"}
@@END@@

@@ACTION@@
{"type":"show_route","from_id":"main-entrance","to_id":"<destination place id>"}
@@END@@

@@ACTION@@
{"type":"open_map"}
@@END@@

नियम: केवल knowledge base के place id; एक से अधिक ACTION नहीं; from_id डिफ़ॉल्ट main-entrance।
"""


def _extract_action(text: str) -> tuple[str, dict | None]:
    pattern = r"@@ACTION@@\s*(\{.*?\})\s*@@END@@"
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return text.strip(), None
    reply = (text[: match.start()] + text[match.end() :]).strip()
    try:
        action = json.loads(match.group(1))
        if not isinstance(action, dict) or "type" not in action:
            return reply, None
        return reply, action
    except json.JSONDecodeError:
        return reply, None


def _wants_navigation(message: str) -> bool:
    t = message.lower()
    keys = [
        "route", "path", "direction", "directions", "navigate", "navigation",
        "take me", "show on map", "open map", "highlight", "on the map",
        "le chalo", "le jao", "kaise jaun", "kaise jaaun", "map par",
        "dikhao map", "show route", "find route", "how do i get", "how to reach",
        "guide me", "walk to", "go to room", "go to office", "show me the way",
        "मार्ग", "रूट", "दिखाओ", "ले चलो", "कैसे जाऊँ", "कैसे जाऊं",
    ]
    return any(k in t for k in keys)


def _validate_action(action: dict | None, kb: dict, message: str) -> dict | None:
    if not action:
        return None
    if not _wants_navigation(message):
        return None

    places = {p["id"]: p for p in kb.get("places", [])}
    routeable = set(kb.get("routeable_place_ids", []))
    t = action.get("type")

    if t == "open_map":
        return {"type": "open_map"}

    if t == "focus_place":
        pid = str(action.get("place_id") or "").strip()
        if pid in places:
            p = places[pid]
            return {
                "type": "focus_place",
                "place_id": pid,
                "name": p.get("name"),
                "floor": p.get("floor"),
                "code": p.get("code"),
            }
        return None

    if t == "show_route":
        frm = str(action.get("from_id") or "main-entrance").strip()
        to = str(action.get("to_id") or "").strip()
        if frm in routeable and to in routeable:
            return {
                "type": "show_route",
                "from_id": frm,
                "to_id": to,
                "from_name": places.get(frm, {}).get("name", frm),
                "to_name": places.get(to, {}).get("name", to),
            }
        if to in places:
            p = places[to]
            return {
                "type": "focus_place",
                "place_id": to,
                "name": p.get("name"),
                "floor": p.get("floor"),
                "code": p.get("code"),
            }
        return None

    return None


async def ask_sili(message: str, language: str = "en") -> dict[str, Any]:
    lang = "hi" if str(language).lower().startswith("hi") else "en"
    kb = knowledge_bundle()
    campus_context = json.dumps(kb, ensure_ascii=False, separators=(",", ":"))
    system = SYSTEM_PROMPT_HI if lang == "hi" else SYSTEM_PROMPT_EN

    if not OLLAMA_API_KEY:
        return _demo_reply(message, kb, lang)

    url = f"{OLLAMA_BASE_URL}/api/chat"
    headers = {
        "Authorization": f"Bearer {OLLAMA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {
                "role": "system",
                "content": system + "\n\nCampus Knowledge Base (JSON):\n" + campus_context,
            },
            {"role": "user", "content": message},
        ],
    }

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    raw = data.get("message", {}).get("content", "")
    if not isinstance(raw, str) or not raw.strip():
        raise RuntimeError("Empty model response")

    reply, action = _extract_action(raw)
    action = _validate_action(action, kb, message)
    return {
        "reply": reply,
        "action": action,
        "language": lang,
        "knowledge_updated_at": kb.get("eventsUpdatedAt"),
    }


def _demo_reply(message: str, kb: dict, lang: str = "en") -> dict[str, Any]:
    text = message.lower().strip()
    places = {p["id"]: p for p in kb.get("places", [])}
    faculty = kb.get("faculty", [])
    events = kb.get("events", [])
    routeable = set(kb.get("routeable_place_ids", []))
    nav = _wants_navigation(message)
    hi = lang == "hi"

    def R(en: str, hindi: str) -> str:
        return hindi if hi else en

    # Events
    if any(w in text for w in ("event", "exam", "avishkar", "pariksha", "upcoming", "कार्यक्रम", "परीक्षा")):
        if not events:
            return {
                "reply": R(
                    "No events or examinations are currently listed in the campus database. "
                    "When an administrator publishes an update, it will appear here automatically.",
                    "वर्तमान में कैंपस डेटाबेस में कोई कार्यक्रम या परीक्षा सूचीबद्ध नहीं है। "
                    "प्रशासक द्वारा अद्यतन प्रकाशित होने पर यह जानकारी यहाँ स्वतः उपलब्ध होगी।",
                ),
                "action": None,
                "language": lang,
                "knowledge_updated_at": kb.get("eventsUpdatedAt"),
            }
        header = R("Current events and examinations:", "वर्तमान कार्यक्रम और परीक्षाएँ:")
        lines = [header]
        for e in events[:10]:
            loc = e.get("location") or e.get("locationCode") or ""
            when = e.get("start") or ""
            lines.append(
                f"- {e.get('title')} ({e.get('kind', 'event')})"
                + (f" @ {loc}" if loc else "")
                + (f" · {when}" if when else "")
            )
        return {
            "reply": "\n".join(lines),
            "action": None,
            "language": lang,
            "knowledge_updated_at": kb.get("eventsUpdatedAt"),
        }

    # Faculty
    for f in faculty:
        name = (f.get("name") or "").lower()
        role = (f.get("role") or "").lower()
        initials = (f.get("initials") or "").lower()
        matched = False
        if name and name in text:
            matched = True
        elif role and role in text:
            matched = True
        elif "dean" in text and ("dean" in name or role == "dean"):
            matched = True
        elif ("डीन" in message or "दीन" in message) and ("dean" in name or role == "dean"):
            matched = True
        elif "hod" in text and ("hod" in name or role == "hod"):
            matched = True
        elif initials and len(initials) > 2 and initials in text:
            matched = True
        if not matched:
            continue

        pid = f.get("staffPlace") or ""
        room = f.get("staffRoom") or f.get("placeCode") or ""
        floor = f.get("placeFloor")
        building = f.get("placeBuilding") or "E-block"
        place_name = f.get("placeName") or ""
        notes = f.get("notes") or ""
        subject = f.get("subject") or "—"

        if hi:
            lines = [
                f"{f.get('name')}"
                + (f" ({f.get('honorific')})" if f.get("honorific") else "")
                + (f" · {f.get('role')}" if f.get("role") else ""),
                f"कार्यालय / विषय: {subject}",
                f"स्थान: कक्ष {room}"
                + (f" · {place_name}" if place_name else "")
                + (f", मंजिल {floor}" if floor is not None else "")
                + f" ({building})।",
            ]
            if notes:
                lines.append(notes)
            if not nav:
                lines.append(
                    f'मानचित्र पर इस कक्ष को देखने के लिए नीचे "3D दृश्य पर जाएँ" दबाएँ।'
                )
        else:
            lines = [
                f"{f.get('name')}"
                + (f" ({f.get('honorific')})" if f.get("honorific") else "")
                + (f" · {f.get('role')}" if f.get("role") else ""),
                f"Office / subject: {subject}",
                f"Venue: Room {room}"
                + (f" · {place_name}" if place_name else "")
                + (f", floor {floor}" if floor is not None else "")
                + f" ({building}).",
            ]
            if notes:
                lines.append(notes)
            if not nav:
                lines.append(
                    f'To view this room on the campus map, use the button below: "Take me to 3D view".'
                )

        if not nav:
            map_action = None
            if pid:
                map_action = {
                    "type": "focus_place",
                    "place_id": pid,
                    "name": places.get(pid, {}).get("name") or place_name or f"Room {room}",
                    "floor": floor if floor is not None else places.get(pid, {}).get("floor"),
                    "code": room,
                }
            return {
                "reply": "\n".join(lines),
                "action": map_action,
                "language": lang,
                "knowledge_updated_at": kb.get("eventsUpdatedAt"),
            }

        action = None
        if pid:
            if any(w in text for w in ("route", "path", "direction", "le ", "kaise", "मार्ग", "रूट")):
                if pid in routeable and "main-entrance" in routeable:
                    action = {
                        "type": "show_route",
                        "from_id": "main-entrance",
                        "to_id": pid,
                        "from_name": "Main Entrance",
                        "to_name": places.get(pid, {}).get("name") or f"Room {room}",
                    }
                    lines.append(
                        R(
                            "Displaying the route from the main entrance on the map.",
                            "मुख्य प्रवेश द्वार से मार्ग मानचित्र पर प्रदर्शित किया जा रहा है।",
                        )
                    )
                else:
                    action = {
                        "type": "focus_place",
                        "place_id": pid,
                        "name": places.get(pid, {}).get("name") or f"Room {room}",
                        "floor": floor,
                        "code": room,
                    }
                    lines.append(
                        R(
                            "Highlighting the venue on the map.",
                            "मानचित्र पर स्थान को चिह्नित किया जा रहा है।",
                        )
                    )
            else:
                action = {
                    "type": "focus_place",
                    "place_id": pid,
                    "name": places.get(pid, {}).get("name") or f"Room {room}",
                    "floor": floor,
                    "code": room,
                }
                lines.append(
                    R(
                        "Highlighting the venue on the map.",
                        "मानचित्र पर स्थान को चिह्नित किया जा रहा है।",
                    )
                )
        return {
            "reply": "\n".join(lines),
            "action": action,
            "language": lang,
            "knowledge_updated_at": kb.get("eventsUpdatedAt"),
        }

    # Places
    for p in places.values():
        tokens = [p.get("name", "").lower(), (p.get("code") or "").lower()]
        tokens = [t for t in tokens if t and len(t) > 1]
        if not any(t in text for t in tokens):
            continue
        if nav and p["id"] in routeable and "main-entrance" in routeable:
            return {
                "reply": R(
                    f"{p.get('name')} is in E-block"
                    + (f", floor {p['floor']}" if p.get("floor") is not None else "")
                    + ". Displaying the route on the map.",
                    f"{p.get('name')} ई-ब्लॉक में स्थित है"
                    + (f", मंजिल {p['floor']}" if p.get("floor") is not None else "")
                    + "। मार्ग मानचित्र पर प्रदर्शित किया जा रहा है।",
                ),
                "action": {
                    "type": "show_route",
                    "from_id": "main-entrance",
                    "to_id": p["id"],
                    "from_name": "Main Entrance",
                    "to_name": p.get("name"),
                },
                "language": lang,
                "knowledge_updated_at": kb.get("eventsUpdatedAt"),
            }
        reply = R(
            f"{p.get('name')}"
            + (f" (code {p['code']})" if p.get("code") else "")
            + f" — {p.get('building')}, "
            + (f"floor {p['floor']}" if p.get("floor") is not None else str(p.get("floorTitle")))
            + f". {p.get('description') or ''}",
            f"{p.get('name')}"
            + (f" (कोड {p['code']})" if p.get("code") else "")
            + f" — {p.get('building')}, "
            + (f"मंजिल {p['floor']}" if p.get("floor") is not None else str(p.get("floorTitle")))
            + f"। {p.get('description') or ''}",
        )
        if not nav:
            reply += R(
                f'\nFor a route, ask: "Route to {p.get("name") or "this place"}".',
                f'\nमार्ग के लिए लिखें: "Route to {p.get("name") or "this place"}"।',
            )
            return {
                "reply": reply,
                "action": None,
                "language": lang,
                "knowledge_updated_at": kb.get("eventsUpdatedAt"),
            }
        return {
            "reply": reply + R(
                "\nHighlighting the location on the map.",
                "\nमानचित्र पर स्थान चिह्नित किया जा रहा है।",
            ),
            "action": {
                "type": "focus_place",
                "place_id": p["id"],
                "name": p.get("name"),
                "floor": p.get("floor"),
                "code": p.get("code"),
            },
            "language": lang,
            "knowledge_updated_at": kb.get("eventsUpdatedAt"),
        }

    return {
        "reply": R(
            "I am SILI — Silver Oak Intelligence, the campus assistant for Silver Oak University. "
            "I can help with faculty details, room locations, events, examinations, and indoor routes. "
            'Examples: "Who is the Dean?", "What events are on campus?", or "Route to IEEE cell".',
            "मैं SILI हूँ — सिल्वर ओक इंटेलिजेंस, सिल्वर ओक यूनिवर्सिटी की कैंपस सहायक। "
            "मैं संकाय विवरण, कक्ष स्थान, कार्यक्रम, परीक्षाएँ और आंतरिक मार्ग में सहायता कर सकती हूँ। "
            'उदाहरण: "डीन कौन हैं?", "कैंपस में कौन से कार्यक्रम हैं?", अथवा "IEEE सेल का रूट"।',
        ),
        "action": None,
        "language": lang,
        "knowledge_updated_at": kb.get("eventsUpdatedAt"),
    }
