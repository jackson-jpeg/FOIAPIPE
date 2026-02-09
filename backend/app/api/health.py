"""Health check endpoints – no authentication required."""

from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_basic() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/detailed")
async def health_detailed(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    checks: dict[str, Any] = {}

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    try:
        r = aioredis.from_url(settings.REDIS_URL)
        try:
            await r.ping()
            checks["redis"] = "ok"
        finally:
            await r.aclose()
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
