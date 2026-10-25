# sili try — Silver Oak Intelligence + SOU 3D DISHA

**SILI** = Silver Oak Intelligence  
Helps visitors, parents, and students with faculty, rooms, events, exams, and paths.

## Behaviour

| You ask | SILI does |
|---------|-----------|
| Who is the Dean? | **Text (+ voice) only** — room/venue in the answer, **no map jump** |
| What events are on campus? | Lists live events/exams from admin data |
| Route to Dean office / Show on map | Returns map action; **you tap the button** to open 3D + highlight/route |
| Mic | Voice input; replies can be spoken (browser TTS or ElevenLabs) |

Admin adds events on the website → SILI sees them automatically (read-only).

Homepage = **your DISHA website**. Floating **S** button = SILI on every page.

## Run (CachyOS / fish)

```fish
cd ~/Downloads
unzip -o sili-try.zip
cd sou-sili

python3 -m venv .venv
source .venv/bin/activate.fish
pip install -r requirements.txt

# optional:
# nano .env
# OLLAMA_API_KEY=...
# OLLAMA_MODEL=llama3.2
# ELEVENLABS_API_KEY=...
# ELEVENLABS_VOICE_ID=...
# SOU_ADMIN_PASSWORD=

uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000/**

Hard-refresh once: **Ctrl+Shift+R**

## Test

1. Open site → bottom-right **S**
2. "Who is the Dean?" → details only, stay on page
3. "Route to Dean office" → answer + **Show route on 3D map** button → tap to navigate
4. Admin events appear when you ask about events
