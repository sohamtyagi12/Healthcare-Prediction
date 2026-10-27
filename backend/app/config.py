"""Runtime configuration, loaded from environment variables / backend/.env."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env regardless of the directory uvicorn is launched from.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", "").strip())
    analysis_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_ANALYSIS_MODEL", "gemini-3.6-flash")
    )
    maps_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_MAPS_MODEL", "gemini-3.6-flash")
    )
    live_model: str = field(
        default_factory=lambda: os.getenv(
            "GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"
        )
    )
    # "osm" = free OpenStreetMap search (default); "gemini" = Gemini Maps grounding (paid tier only)
    care_provider: str = field(default_factory=lambda: os.getenv("CARE_PROVIDER", "osm").strip().lower())
    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        )
    )
    # Reject lab-report uploads larger than this (decoded bytes).
    max_image_bytes: int = 10 * 1024 * 1024


def get_settings() -> Settings:
    # Re-read on every call so tests / .env edits are picked up without caching surprises.
    return Settings()
