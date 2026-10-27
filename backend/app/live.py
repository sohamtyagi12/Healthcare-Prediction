"""Gemini Live voice consult, proxied through a WebSocket.

Browser  --(binary: 16 kHz PCM16 mic audio)-->  FastAPI  --> Gemini Live
Browser  <--(binary: 24 kHz PCM16 reply audio)--  FastAPI  <-- Gemini Live
Browser  <--(text JSON: {"type": "ready" | "error", ...})--  FastAPI

This keeps the API key off the client; the browser never talks to Google directly.
"""
import asyncio
import contextlib
import logging

from fastapi import WebSocket, WebSocketDisconnect
from google.genai import types

from .config import get_settings
from .gemini_service import GeminiNotConfigured, get_client

log = logging.getLogger("medpredict.live")

SYSTEM_INSTRUCTION = (
    "You are MedPredict AI, a professional medical assistant. Provide concise, helpful "
    "health advice based on symptoms described. Keep it clinically focused. Remind users "
    "you are AI and not a doctor when giving medical advice."
)


async def live_consult(ws: WebSocket) -> None:
    await ws.accept()
    try:
        client = get_client()
    except GeminiNotConfigured as exc:
        await ws.send_json({"type": "error", "message": str(exc)})
        await ws.close(code=1011)
        return

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=SYSTEM_INSTRUCTION,
    )

    try:
        async with client.aio.live.connect(model=get_settings().live_model, config=config) as session:
            await ws.send_json({"type": "ready"})

            async def browser_to_gemini() -> None:
                while True:
                    chunk = await ws.receive_bytes()
                    await session.send_realtime_input(
                        audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                    )

            async def gemini_to_browser() -> None:
                # session.receive() ends after each model turn, so loop for the whole call.
                while True:
                    async for message in session.receive():
                        content = message.server_content
                        if content and content.model_turn:
                            for part in content.model_turn.parts or []:
                                if part.inline_data and part.inline_data.data:
                                    await ws.send_bytes(part.inline_data.data)

            tasks = [
                asyncio.create_task(browser_to_gemini()),
                asyncio.create_task(gemini_to_browser()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, WebSocketDisconnect):
                    raise exc
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # upstream/network failure
        log.exception("Live session failed")
        with contextlib.suppress(Exception):
            await ws.send_json({"type": "error", "message": f"Live session failed: {exc}"})
    finally:
        with contextlib.suppress(Exception):
            await ws.close()
