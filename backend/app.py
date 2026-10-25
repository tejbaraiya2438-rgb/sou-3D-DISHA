from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import APP_VERSION, BASE_DIR
from backend.routes import router as api_router
try:
    from services.text_to_speech import router as speech_router
except Exception:
    speech_router = None

app = FastAPI(
    title="SOU-SILI | Silver Oak University",
    version=APP_VERSION,
    description="Integrated campus map + SILI agentic assistant",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "static" / "assets")), name="assets")
app.mount("/3d", StaticFiles(directory=str(BASE_DIR / "3d")), name="threed")

# Serve campus-map-data.js at root for module imports used by 3D
@app.get("/campus-map-data.js", include_in_schema=False)
async def campus_map_data():
    return FileResponse(BASE_DIR / "campus-map-data.js", media_type="application/javascript")


@app.get("/", include_in_schema=False)
async def home():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/map", include_in_schema=False)
async def map_page():
    """Alias — same as homepage (DISHA + floating SILI)."""
    return FileResponse(BASE_DIR / "index.html")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "SOU-SILI", "version": APP_VERSION}


app.include_router(api_router, prefix="/api")
if speech_router is not None:
    app.include_router(speech_router, prefix="/api")
