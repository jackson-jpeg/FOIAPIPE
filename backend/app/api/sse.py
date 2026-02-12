"""Server-Sent Events endpoint for live updates.

SSE is simpler than WebSockets, works through proxies/Railway, and is
sufficient for one-way server-to-client updates.  Uses Redis pub/sub so
events emitted from Celery tasks also reach connected clients.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from app.config import settings
from app.services.cache import SSE_CHANNEL, get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sse", tags=["sse"])


async def _get_sse_user(token: str = Query(...)) -> str:
    """Validate JWT passed as query param (SSE doesn't support custom headers)."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise ValueError("No subject in token")
        return username
    except (JWTError, ValueError):
        raise


@router.get("/events")
async def event_stream(_user: str = Depends(_get_sse_user)):
    """SSE endpoint — streams events from Redis pub/sub to the client."""

    async def generate():
        r = await get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(SSE_CHANNEL)
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                        timeout=30,
                    )
                    if msg and msg["type"] == "message":
                        data = msg["data"]
                        if isinstance(data, bytes):
                            data = data.decode()
                        parsed = json.loads(data)
                        event_type = parsed.get("type", "message")
                        yield f"event: {event_type}\ndata: {json.dumps(parsed)}\n\n"
                    else:
                        # Send keepalive comment to prevent connection timeout
                        yield ": keepalive\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(SSE_CHANNEL)
            await pubsub.aclose()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
