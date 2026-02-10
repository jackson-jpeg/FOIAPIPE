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
from app.models.agency import Agency
from app.models.news_article import Severity
from app.models.news_source_health import NewsSourceHealth
from sqlalchemy import and_

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


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get comprehensive dashboard summary with all key metrics.

    Returns today's stats, trends, top performers, and system health.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    # Today's stats
    articles_today = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                NewsArticle.created_at >= today_start
            )
        )
    ).scalar() or 0

    high_severity_today = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                and_(
                    NewsArticle.created_at >= today_start,
                    NewsArticle.severity == Severity.high,
                )
            )
        )
    ).scalar() or 0

    foias_submitted_today = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.submitted_at >= today_start
            )
        )
    ).scalar() or 0

    videos_published_today = (
        await db.execute(
            select(func.count(Video.id)).where(
                and_(
                    Video.published_at >= today_start,
                    Video.status == VideoStatus.published,
                )
            )
        )
    ).scalar() or 0

    # Week trends
    articles_week = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                NewsArticle.created_at >= week_start
            )
        )
    ).scalar() or 0

    foias_week = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.created_at >= week_start
            )
        )
    ).scalar() or 0

    videos_week = (
        await db.execute(
            select(func.count(Video.id)).where(Video.created_at >= week_start)
        )
    ).scalar() or 0

    # Month trends
    articles_month = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                NewsArticle.created_at >= month_start
            )
        )
    ).scalar() or 0

    foias_month = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.created_at >= month_start
            )
        )
    ).scalar() or 0

    videos_month = (
        await db.execute(
            select(func.count(Video.id)).where(Video.created_at >= month_start)
        )
    ).scalar() or 0

    # FOIA status breakdown
    foia_status_counts = {}
    status_rows = (
        await db.execute(
            select(FoiaRequest.status, func.count(FoiaRequest.id)).group_by(
                FoiaRequest.status
            )
        )
    ).all()

    for status, count in status_rows:
        foia_status_counts[status.value] = count

    # Top performing videos (past 30 days)
    top_videos_result = await db.execute(
        select(
            Video.id,
            Video.title,
            func.sum(VideoAnalytics.views).label("total_views"),
            func.sum(VideoAnalytics.estimated_revenue).label("total_revenue"),
        )
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id)
        .where(
            and_(
                Video.published_at >= month_start,
                VideoAnalytics.date >= month_start.date(),
            )
        )
        .group_by(Video.id, Video.title)
        .order_by(func.sum(VideoAnalytics.views).desc())
        .limit(5)
    )

    top_videos = [
        {
            "id": str(row.id),
            "title": row.title,
            "views": int(row.total_views or 0),
            "revenue": float(row.total_revenue or 0),
        }
        for row in top_videos_result.all()
    ]

    # Agency performance leaderboard
    agency_performance_result = await db.execute(
        select(
            Agency.id,
            Agency.name,
            Agency.abbreviation,
            func.count(FoiaRequest.id).label("total_requests"),
            func.count(
                func.nullif(FoiaRequest.status == FoiaStatus.fulfilled, False)
            ).label("fulfilled_count"),
        )
        .join(FoiaRequest, FoiaRequest.agency_id == Agency.id)
        .where(FoiaRequest.submitted_at >= month_start)
        .group_by(Agency.id, Agency.name, Agency.abbreviation)
        .order_by(func.count(FoiaRequest.id).desc())
        .limit(10)
    )

    agency_performance = [
        {
            "id": str(row.id),
            "name": row.name,
            "abbreviation": row.abbreviation,
            "total_requests": row.total_requests,
            "fulfilled_count": row.fulfilled_count,
            "fulfillment_rate": (
                round((row.fulfilled_count / row.total_requests) * 100, 1)
                if row.total_requests > 0
                else 0
            ),
        }
        for row in agency_performance_result.all()
    ]

    # Revenue summary
    revenue_month_result = await db.execute(
        select(func.sum(VideoAnalytics.estimated_revenue)).where(
            VideoAnalytics.date >= month_start.date()
        )
    )
    revenue_month = float(revenue_month_result.scalar() or 0)

    cost_month_result = await db.execute(
        select(func.sum(FoiaRequest.actual_cost)).where(
            and_(
                FoiaRequest.fulfilled_at >= month_start,
                FoiaRequest.actual_cost.isnot(None),
            )
        )
    )
    cost_month = float(cost_month_result.scalar() or 0)

    profit_month = revenue_month - cost_month
    roi_month = (
        round((profit_month / max(cost_month, 1)) * 100, 1) if cost_month > 0 else 0
    )

    # System health
    circuit_breakers_result = await db.execute(
        select(
            func.count(NewsSourceHealth.id).label("total_sources"),
            func.count(
                func.nullif(NewsSourceHealth.is_circuit_open, False)
            ).label("circuits_open"),
        )
    )
    circuit_row = circuit_breakers_result.first()

    circuit_breakers = {
        "total_sources": circuit_row.total_sources if circuit_row else 0,
        "circuits_open": circuit_row.circuits_open if circuit_row else 0,
        "all_healthy": (
            circuit_row.circuits_open == 0 if circuit_row else True
        ),
    }

    overdue_foias = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                and_(
                    FoiaRequest.due_date < now,
                    FoiaRequest.status.notin_(
                        [FoiaStatus.fulfilled, FoiaStatus.closed, FoiaStatus.denied]
                    ),
                )
            )
        )
    ).scalar() or 0

    videos_ready = (
        await db.execute(
            select(func.count(Video.id)).where(
                Video.status == VideoStatus.ready_for_upload
            )
        )
    ).scalar() or 0

    # Recent activity
    recent_articles_result = await db.execute(
        select(NewsArticle)
        .order_by(NewsArticle.created_at.desc())
        .limit(5)
    )
    recent_articles = [
        {
            "id": str(article.id),
            "headline": article.headline,
            "severity": article.severity.value if article.severity else None,
            "source": article.source_name,
            "created_at": article.created_at.isoformat() if article.created_at else None,
        }
        for article in recent_articles_result.scalars().all()
    ]

    recent_foias_result = await db.execute(
        select(FoiaRequest)
        .where(FoiaRequest.submitted_at.isnot(None))
        .order_by(FoiaRequest.submitted_at.desc())
        .limit(5)
    )
    recent_foias = [
        {
            "id": str(foia.id),
            "case_number": foia.case_number,
            "agency_name": foia.agency.name if foia.agency else None,
            "status": foia.status.value,
            "submitted_at": foia.submitted_at.isoformat() if foia.submitted_at else None,
        }
        for foia in recent_foias_result.scalars().all()
    ]

    return {
        "timestamp": now.isoformat(),
        "today": {
            "articles": articles_today,
            "high_severity_articles": high_severity_today,
            "foias_submitted": foias_submitted_today,
            "videos_published": videos_published_today,
        },
        "week": {
            "articles": articles_week,
            "foias": foias_week,
            "videos": videos_week,
        },
        "month": {
            "articles": articles_month,
            "foias": foias_month,
            "videos": videos_month,
        },
        "foia_status": foia_status_counts,
        "top_videos": top_videos,
        "agency_performance": agency_performance,
        "revenue": {
            "month_revenue": round(revenue_month, 2),
            "month_costs": round(cost_month, 2),
            "month_profit": round(profit_month, 2),
            "month_roi_percent": roi_month,
        },
        "system_health": {
            "circuit_breakers": circuit_breakers,
            "overdue_foias": overdue_foias,
            "videos_ready_for_upload": videos_ready,
        },
        "recent_activity": {
            "articles": recent_articles,
            "foias": recent_foias,
        },
    }
