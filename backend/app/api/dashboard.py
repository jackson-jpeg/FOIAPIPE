"""Dashboard router – aggregate statistics across all tables."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models import (
    FoiaRequest,
    FoiaStatus,
    NewsArticle,
    Notification,
    RevenueTransaction,
    ScanLog,
    Video,
    VideoAnalytics,
    VideoStatus,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_STATS_CACHE_KEY = "foiapipe:dashboard:stats"
DASHBOARD_STATS_TTL = 60


@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Return aggregate statistics for the dashboard overview."""
    try:
        r = aioredis.from_url(settings.REDIS_URL)
        try:
            cached = await r.get(DASHBOARD_STATS_CACHE_KEY)
            if cached is not None:
                return json.loads(cached)
        finally:
            await r.aclose()
    except Exception:
        cached = None

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_articles = (
        await db.execute(select(func.count(NewsArticle.id)))
    ).scalar_one()

    articles_this_week = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                NewsArticle.created_at >= week_ago
            )
        )
    ).scalar_one()

    foia_rows = (
        await db.execute(
            select(FoiaRequest.status, func.count(FoiaRequest.id)).group_by(
                FoiaRequest.status
            )
        )
    ).all()
    active_foias: dict[str, int] = {row[0].value: row[1] for row in foia_rows}

    video_rows = (
        await db.execute(
            select(Video.status, func.count(Video.id)).group_by(Video.status)
        )
    ).all()
    video_pipeline_counts: dict[str, int] = {
        row[0].value: row[1] for row in video_rows
    }

    total_views = (
        await db.execute(select(func.coalesce(func.sum(VideoAnalytics.views), 0)))
    ).scalar_one()

    revenue_mtd = (
        await db.execute(
            select(func.coalesce(func.sum(RevenueTransaction.amount), 0)).where(
                RevenueTransaction.is_income.is_(True),
                RevenueTransaction.transaction_date >= month_start.date(),
            )
        )
    ).scalar_one()

    recent_rows = (
        await db.execute(
            select(Notification)
            .order_by(Notification.created_at.desc())
            .limit(10)
        )
    ).scalars().all()
    recent_activity = [
        {
            "id": str(n.id),
            "type": n.type.value,
            "title": n.title,
            "message": n.message,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "link": n.link,
        }
        for n in recent_rows
    ]

    result = {
        "total_articles": total_articles,
        "articles_this_week": articles_this_week,
        "active_foias": active_foias,
        "video_pipeline_counts": video_pipeline_counts,
        "total_views": total_views,
        "revenue_mtd": float(revenue_mtd),
        "recent_activity": recent_activity,
    }

    try:
        r = aioredis.from_url(settings.REDIS_URL)
        try:
            await r.set(DASHBOARD_STATS_CACHE_KEY, json.dumps(result), ex=DASHBOARD_STATS_TTL)
        finally:
            await r.aclose()
    except Exception:
        pass

    return result
