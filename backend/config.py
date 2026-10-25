import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Load API keys from project-root .env
load_dotenv(BASE_DIR / ".env")
load_dotenv()  # also allow process env / cwd .env

OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL", "https://ollama.com"
).rstrip("/")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")

ADMIN_PASSWORD = os.getenv("SOU_ADMIN_PASSWORD", "admin123")
APP_NAME = "SOU-SILI"
APP_VERSION = "2.1.0"
