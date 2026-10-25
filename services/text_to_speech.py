
import httpx

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

router = APIRouter()


class SpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=3000)


@router.post("/speech")
async def generate_speech(request: SpeechRequest):
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        raise HTTPException(
            status_code=503,
            detail="Voice service is not configured yet.",
        )

    text = request.text.strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty.",
        )

    url = (
        "https://api.elevenlabs.io/v1/text-to-speech/"
        f"{ELEVENLABS_VOICE_ID}"
    )

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            result = await client.post(
                url,
                headers=headers,
                json=payload,
            )
            result.raise_for_status()

        return Response(
            content=result.content,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )

    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        # Log upstream status and a limited response body; never log API keys.
        print(f"ElevenLabs upstream HTTP status: {status}")
        print(f"ElevenLabs upstream response: {exc.response.text[:1000]}")

        if status in (401, 403):
            detail = "Voice service authentication failed."
        elif status == 429:
            detail = "Voice service rate limit reached."
        else:
            detail = "Voice generation failed. Check server logs."

        raise HTTPException(status_code=502, detail=detail)

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the voice service.",
        )
