"""All Gemini calls live here (Python port of services/geminiService.ts).

The API key stays on the server: the browser only ever talks to our /api routes.
"""
import base64
import binascii
import json
from typing import Optional

from google import genai
from google.genai import types

from .config import get_settings
from .schemas import (
    AnalysisResult,
    FindCareResponse,
    LabReportSummary,
    UserProfile,
)


class GeminiNotConfigured(RuntimeError):
    """GEMINI_API_KEY is missing."""


class InvalidImage(ValueError):
    """The uploaded lab-report image could not be decoded / is too large."""


_client: Optional[genai.Client] = None
_client_key: str = ""


def get_client() -> genai.Client:
    """Return one shared Gemini client.

    The client must be kept alive (not recreated per call): a throw-away client gets
    garbage-collected mid-request, which closes its HTTP connection and breaks retries
    with "Cannot send a request, as the client has been closed."
    """
    global _client, _client_key
    key = get_settings().gemini_api_key
    if not key:
        raise GeminiNotConfigured(
            "GEMINI_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key."
        )
    if _client is None or key != _client_key:
        # Google sometimes answers 503 "high demand" / 429 for a few seconds; retry with
        # backoff instead of failing the user's request on the first hiccup.
        retry = types.HttpRetryOptions(
            attempts=5,
            initial_delay=2.0,
            max_delay=20.0,
            http_status_codes=[429, 500, 503, 504],
        )
        _client = genai.Client(api_key=key, http_options=types.HttpOptions(retry_options=retry))
        _client_key = key
    return _client


# ---------------------------------------------------------------- helpers
def _profile_context(profile: Optional[UserProfile], *, detailed: bool) -> str:
    """Build the patient-context line, skipping fields the user left blank."""
    if not profile:
        return ""
    parts = []
    demo = " ".join(x for x in [f"{profile.age}yo" if profile.age else "", profile.gender or ""] if x)
    if demo:
        parts.append(demo)
    if detailed:
        if profile.weight:
            parts.append(f"weight {profile.weight}")
        if profile.height:
            parts.append(f"height {profile.height}")
    text = ", ".join(parts)
    extras = []
    if detailed and profile.allergies:
        extras.append(f"Allergies: {profile.allergies}.")
    if profile.medicalHistory:
        extras.append(f"History: {profile.medicalHistory}.")
    out = " ".join(x for x in [f"{text}." if text else "", *extras] if x)
    return f"Patient Profile: {out}" if out else ""


def sniff_mime_type(data: bytes) -> str:
    """Detect the image type from magic bytes (the frontend always labelled everything JPEG)."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data.startswith(b"%PDF"):
        return "application/pdf"
    return "image/jpeg"


def decode_image(b64: str) -> bytes:
    # Tolerate a full data URL even though the frontend strips the prefix.
    if b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImage("Image is not valid base64.") from exc
    if not data:
        raise InvalidImage("Image is empty.")
    if len(data) > get_settings().max_image_bytes:
        raise InvalidImage("Image is too large (max 10 MB).")
    return data


def _parse_json_response(response, model_cls):
    """Prefer the SDK's parsed object; fall back to parsing response.text."""
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, model_cls):
        return parsed
    return model_cls.model_validate(json.loads(response.text or "{}"))


# ---------------------------------------------------------------- features
async def analyze_symptoms(symptoms: str, profile: Optional[UserProfile] = None) -> AnalysisResult:
    context = _profile_context(profile, detailed=True)
    response = await get_client().aio.models.generate_content(
        model=get_settings().analysis_model,
        contents=f"{context}\nAnalyze these symptoms: {symptoms}. Respond in JSON format.",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AnalysisResult,
        ),
    )
    return _parse_json_response(response, AnalysisResult)


async def analyze_lab_report(image_b64: str, profile: Optional[UserProfile] = None) -> LabReportSummary:
    data = decode_image(image_b64)
    context = _profile_context(profile, detailed=False)
    response = await get_client().aio.models.generate_content(
        model=get_settings().analysis_model,
        contents=[
            types.Part.from_bytes(data=data, mime_type=sniff_mime_type(data)),
            f"{context}\nExtract and interpret clinical lab data. Identify abnormal values.",
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=LabReportSummary,
            max_output_tokens=16384,  # thinking + JSON share this budget; too low => truncated JSON
        ),
    )
    return _parse_json_response(response, LabReportSummary)


async def find_specialized_care(specialization: str, lat: float, lng: float) -> FindCareResponse:
    response = await get_client().aio.models.generate_content(
        model=get_settings().maps_model,
        contents=(
            f"Find highly-rated {specialization} doctors, clinics, and hospitals near my "
            "location. Include contact details if possible."
        ),
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_maps=types.GoogleMaps())],
            tool_config=types.ToolConfig(
                retrieval_config=types.RetrievalConfig(
                    lat_lng=types.LatLng(latitude=lat, longitude=lng)
                )
            ),
        ),
    )
    return FindCareResponse(text=response.text or "", links=_grounding_links(response))


def _grounding_links(response) -> list[dict]:
    """Convert grounding chunks to the camelCase JSON the React app already expects."""
    candidates = getattr(response, "candidates", None) or []
    metadata = getattr(candidates[0], "grounding_metadata", None) if candidates else None
    chunks = getattr(metadata, "grounding_chunks", None) or []
    links: list[dict] = []
    for chunk in chunks:
        if getattr(chunk, "maps", None):
            m = chunk.maps
            links.append({"maps": {"title": m.title, "uri": m.uri, "placeId": getattr(m, "place_id", None)}})
        elif getattr(chunk, "web", None):
            w = chunk.web
            links.append({"web": {"title": w.title, "uri": w.uri}})
    return links