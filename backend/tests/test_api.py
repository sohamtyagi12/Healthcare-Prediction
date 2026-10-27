"""API tests with the Gemini SDK mocked out (no network / API key needed)."""
import base64
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import gemini_service, live
from app.main import app

client = TestClient(app)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


class FakeModels:
    def __init__(self, response, sink):
        self._response, self._sink = response, sink

    async def generate_content(self, **kwargs):
        self._sink.update(kwargs)
        return self._response


def fake_client(response, sink):
    return SimpleNamespace(aio=SimpleNamespace(models=FakeModels(response, sink)))


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")


def test_health_reports_config_without_leaking_key():
    r = client.get("/api/health")
    assert r.json() == {"status": "ok", "geminiConfigured": True}
    assert "test-key" not in r.text


def test_missing_key_gives_503(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    r = client.post("/api/analyze-symptoms", json={"symptoms": "headache"})
    assert r.status_code == 503
    assert "GEMINI_API_KEY" in r.json()["detail"]


def test_analyze_symptoms(monkeypatch):
    sent = {}
    payload = {
        "condition": "Migraine", "probability": 72, "urgency": "Low",
        "description": "d", "recommendations": ["rest"], "caveats": "c",
    }
    monkeypatch.setattr(gemini_service, "get_client", lambda: fake_client(SimpleNamespace(parsed=None, text=json.dumps(payload)), sent))
    r = client.post("/api/analyze-symptoms", json={
        "symptoms": "headache and nausea",
        # full frontend profile incl. extra fields must be accepted
        "profile": {"name": "A", "email": "a@b.c", "age": "30", "gender": "Male", "reminders": [], "history": []},
    })
    assert r.status_code == 200
    assert r.json() == payload
    assert "30yo Male" in sent["contents"] and "headache and nausea" in sent["contents"]
    assert "undefined" not in sent["contents"]


def test_symptoms_validation():
    assert client.post("/api/analyze-symptoms", json={"symptoms": ""}).status_code == 422


def test_gemini_failure_is_502_and_generic(monkeypatch):
    class Boom:
        aio = SimpleNamespace(models=SimpleNamespace(generate_content=None))

    async def boom(**_):
        raise RuntimeError("secret upstream detail")

    Boom.aio.models.generate_content = boom
    monkeypatch.setattr(gemini_service, "get_client", lambda: Boom())
    r = client.post("/api/analyze-symptoms", json={"symptoms": "x"})
    assert r.status_code == 502
    assert "secret" not in r.text


def test_analyze_lab_report(monkeypatch):
    sent = {}
    payload = {
        "parameters": [{"name": "Hb", "value": "9", "unit": "g/dL", "status": "Abnormal", "notes": "low"}],
        "overallHealthScore": 61, "interpretation": "i",
    }
    monkeypatch.setattr(gemini_service, "get_client", lambda: fake_client(SimpleNamespace(parsed=None, text=json.dumps(payload)), sent))
    r = client.post("/api/analyze-lab-report", json={"image": base64.b64encode(PNG).decode()})
    assert r.status_code == 200 and r.json() == payload
    assert sent["contents"][0].inline_data.mime_type == "image/png"  # sniffed, not hard-coded JPEG


def test_lab_report_bad_base64():
    r = client.post("/api/analyze-lab-report", json={"image": "!!!not-base64!!!"})
    assert r.status_code == 422


def test_find_care_maps_grounding(monkeypatch):
    monkeypatch.setenv("CARE_PROVIDER", "gemini")
    sent = {}
    chunks = [
        SimpleNamespace(maps=SimpleNamespace(title="City Hospital", uri="https://maps.google.com/?cid=1", place_id="p1"), web=None),
        SimpleNamespace(maps=None, web=SimpleNamespace(title="W", uri="https://w.example")),
    ]
    resp = SimpleNamespace(
        text="Here are options",
        candidates=[SimpleNamespace(grounding_metadata=SimpleNamespace(grounding_chunks=chunks))],
    )
    monkeypatch.setattr(gemini_service, "get_client", lambda: fake_client(resp, sent))
    r = client.post("/api/find-care", json={"specialization": "Cardiology", "lat": 12.97, "lng": 77.59})
    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "Here are options"
    assert body["links"][0] == {"maps": {"title": "City Hospital", "uri": "https://maps.google.com/?cid=1", "placeId": "p1"}}
    cfg = sent["config"]
    assert cfg.tools[0].google_maps is not None
    assert cfg.tool_config.retrieval_config.lat_lng.latitude == 12.97


def test_find_care_rejects_bad_coords():
    assert client.post("/api/find-care", json={"specialization": "x", "lat": 999, "lng": 0}).status_code == 422


# ------------------------------------------------------------ live WebSocket
class FakeLiveSession:
    def __init__(self):
        self.received = []
        self._sent_reply = False

    async def send_realtime_input(self, audio):
        self.received.append((audio.data, audio.mime_type))

    async def receive(self):
        import asyncio
        while not self.received:
            await asyncio.sleep(0.01)
        if not self._sent_reply:
            self._sent_reply = True
            part = SimpleNamespace(inline_data=SimpleNamespace(data=b"\x01\x02reply"))
            yield SimpleNamespace(server_content=SimpleNamespace(model_turn=SimpleNamespace(parts=[part])))
        import asyncio as a
        await a.sleep(3600)  # stay open like a real session


class FakeLiveCtx:
    def __init__(self, session): self.session = session
    async def __aenter__(self): return self.session
    async def __aexit__(self, *a): return False


def test_live_websocket_proxies_audio(monkeypatch):
    session = FakeLiveSession()
    fake = SimpleNamespace(aio=SimpleNamespace(live=SimpleNamespace(connect=lambda **kw: FakeLiveCtx(session))))
    monkeypatch.setattr(live, "get_client", lambda: fake)
    with client.websocket_connect("/api/live") as ws:
        assert ws.receive_json() == {"type": "ready"}
        ws.send_bytes(b"mic-audio")
        assert ws.receive_bytes() == b"\x01\x02reply"
    assert session.received[0] == (b"mic-audio", "audio/pcm;rate=16000")


def test_live_websocket_reports_missing_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    with client.websocket_connect("/api/live") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error" and "GEMINI_API_KEY" in msg["message"]


# ---------------------------------------------------------------- OpenStreetMap care search
def _osm_elements():
    return [
        {"type": "node", "lat": 12.9716, "lon": 77.5946, "tags": {"amenity": "hospital", "name": "Near Hospital", "emergency": "yes", "addr:city": "Bengaluru"}},
        {"type": "way", "center": {"lat": 12.99, "lon": 77.60}, "tags": {"amenity": "clinic", "name": "Far Clinic"}},
        {"type": "node", "lat": 12.9717, "lon": 77.5947, "tags": {"amenity": "hospital"}},  # unnamed -> skipped
        {"type": "node", "lat": 12.9716, "lon": 77.5946, "tags": {"amenity": "hospital", "name": "Near Hospital"}},  # duplicate
    ]


def test_find_care_uses_openstreetmap_by_default(monkeypatch):
    from app import places

    async def fake_query(query):
        assert "amenity" in query and "around:" in query
        return _osm_elements()

    monkeypatch.setattr(places, "_query_overpass", fake_query)
    monkeypatch.setenv("GEMINI_API_KEY", "")  # free search must not need a Gemini key
    r = client.post("/api/find-care", json={"specialization": "Viral Illness", "lat": 12.9716, "lng": 77.5946})
    assert r.status_code == 200
    links = r.json()["links"]
    assert [l["maps"]["title"] for l in links] == ["Near Hospital", "Far Clinic"]  # closest first, deduped
    assert links[0]["maps"]["distanceKm"] == 0.0
    assert links[0]["maps"]["emergency"] is True
    assert links[0]["maps"]["uri"].startswith("https://www.google.com/maps/dir/?api=1&destination=12.9716,77.5946")
    assert "Found 2" in r.json()["text"]


def test_find_care_osm_failure_is_502(monkeypatch):
    from app import places

    async def boom(query):
        raise places.CareLookupError("down")

    monkeypatch.setattr(places, "_query_overpass", boom)
    r = client.post("/api/find-care", json={"specialization": "Clinic", "lat": 1, "lng": 1})
    assert r.status_code == 502


def test_osm_filters_by_specialization():
    from app import places
    assert places._filters("Dentist") == ['["amenity"="dentist"]']
    assert places._filters("Emergency") == ['["amenity"="hospital"]']
    assert len(places._filters("Viral Illness")) == 2
