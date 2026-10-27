# MedPredict AI — Healthcare Prediction

AI-powered medical companion: symptom analysis, lab-report reading, nearby-care finder and a live voice consult.

- **Frontend:** React + Vite + TypeScript
- **Backend:** Python (FastAPI) + Google Gemini (`google-genai`)

The Gemini API key lives **only on the backend** (`backend/.env`). The browser never sees it.

## Architecture

```
React (Vite :3000) ──/api/*──▶ FastAPI (:8000) ──▶ Gemini API
        └──── WebSocket /api/live (voice) ─────────┘
```

| Endpoint | Purpose |
|---|---|
| `POST /api/analyze-symptoms` | Structured symptom analysis (condition, urgency, recommendations) |
| `POST /api/analyze-lab-report` | Reads a lab-report image and flags abnormal values |
| `POST /api/find-care` | Nearby doctors/hospitals via Gemini + Google Maps grounding |
| `WS   /api/live` | Real-time voice consult (browser mic ⇄ Gemini Live) |
| `GET  /api/health` | Status + whether the key is configured |

## Run locally

**Prerequisites:** Node.js 18+, Python 3.10+, a [Gemini API key](https://aistudio.google.com/apikey)

### 1. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then put your key in GEMINI_API_KEY=
python -m uvicorn app.main:app --reload --port 8000
```
Check it: http://localhost:8000/api/health → `"geminiConfigured": true`
(interactive API docs at http://localhost:8000/docs)

### 2. Frontend (new terminal, repo root)
```bash
npm install
npm run dev
```
Open http://localhost:3000. Vite proxies `/api` to the backend automatically.

### Tests
```bash
cd backend && python -m pytest -q
```

## Configuration (`backend/.env`)

| Variable | Default |
|---|---|
| `GEMINI_API_KEY` | *(required)* |
| `GEMINI_ANALYSIS_MODEL` | `gemini-3.6-flash` |
| `GEMINI_MAPS_MODEL` | `gemini-3.6-flash` |
| `GEMINI_LIVE_MODEL` | `gemini-2.5-flash-native-audio-preview-12-2025` |
| `CARE_PROVIDER` | `osm` (free OpenStreetMap hospital search; `gemini` = Gemini Maps grounding, paid tier only) |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` |

For a deployed backend, build the frontend with `VITE_API_URL=https://your-api.example.com` and add the frontend origin to `CORS_ORIGINS`.

> ⚠️ Not a medical device. AI output is informational only and is not a substitute for professional medical advice.
