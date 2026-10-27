"""MedPredict AI backend (FastAPI). Run with:  uvicorn app.main:app --reload --port 8000"""
import logging

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from . import gemini_service as gemini
from . import places
from .config import get_settings
from .live import live_consult
from .schemas import (
    AnalysisResult,
    FindCareRequest,
    FindCareResponse,
    LabReportRequest,
    LabReportSummary,
    SymptomRequest,
)

log = logging.getLogger("medpredict")

app = FastAPI(title="MedPredict AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _upstream_error(exc: Exception) -> HTTPException:
    """Translate SDK/config failures into clean HTTP errors (never leak the key)."""
    if isinstance(exc, gemini.GeminiNotConfigured):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, gemini.InvalidImage):
        return HTTPException(status_code=422, detail=str(exc))
    log.exception("Gemini request failed")

    # Give the user the real reason instead of one generic message.
    code = getattr(exc, "code", None)  # google.genai.errors.APIError exposes .code
    if code == 429:
        return HTTPException(status_code=429, detail="Gemini quota / rate limit reached. Wait a minute and retry, or check your plan at aistudio.google.com.")
    if code in (401, 403):
        return HTTPException(status_code=502, detail="Gemini rejected the API key (invalid, restricted, or no access to this model). Check GEMINI_API_KEY in backend/.env.")
    if code == 404:
        return HTTPException(status_code=502, detail="Gemini model not found. Check GEMINI_ANALYSIS_MODEL in backend/.env.")
    if code == 400:
        return HTTPException(status_code=502, detail=f"Gemini rejected the request: {getattr(exc, 'message', str(exc))[:200]}")
    if code in (500, 503, 504):
        return HTTPException(status_code=502, detail="Gemini is overloaded right now. Please retry in a moment.")
    if exc.__class__.__name__ in ("ValidationError", "JSONDecodeError"):
        return HTTPException(status_code=502, detail="Gemini returned an incomplete/invalid answer (output was cut off). Please retry.")
    return HTTPException(status_code=502, detail=f"AI service error: {exc.__class__.__name__}")


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "geminiConfigured": bool(get_settings().gemini_api_key)}


@app.post("/api/analyze-symptoms", response_model=AnalysisResult)
async def analyze_symptoms(req: SymptomRequest):
    try:
        return await gemini.analyze_symptoms(req.symptoms, req.profile)
    except Exception as exc:
        raise _upstream_error(exc) from exc


@app.post("/api/analyze-lab-report", response_model=LabReportSummary)
async def analyze_lab_report(req: LabReportRequest):
    try:
        return await gemini.analyze_lab_report(req.image, req.profile)
    except Exception as exc:
        raise _upstream_error(exc) from exc


@app.post("/api/find-care", response_model=FindCareResponse)
async def find_care(req: FindCareRequest):
    try:
        if get_settings().care_provider == "gemini":
            return await gemini.find_specialized_care(req.specialization, req.lat, req.lng)
        return await places.find_nearby_care(req.specialization, req.lat, req.lng)
    except Exception as exc:
        raise _upstream_error(exc) from exc


@app.websocket("/api/live")
async def live(ws: WebSocket):
    await live_consult(ws)
