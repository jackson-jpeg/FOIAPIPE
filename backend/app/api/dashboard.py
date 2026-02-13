"""Dashboard router – aggregate statistics across all tables."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.services.cache import cache_get, cache_set
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
from app.models.app_setting import AppSetting
from app.models.audit_log import AuditLog, AuditAction
from app.models.news_source_health import NewsSourceHealth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_STATS_CACHE_KEY = "dashboard:stats"
DASHBOARD_STATS_TTL = 60


@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Return aggregate statistics for the dashboard overview.

    Returns a structure with:
    - stats: summary numbers with week-over-week trends
    - recent_articles: 5 most recent news articles
    - top_videos: 5 top-performing videos by views
    - activities: 10 most recent notification activity items
    """
    cached = await cache_get(DASHBOARD_STATS_CACHE_KEY)
    if cached is not None:
        return cached

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (month_start - timedelta(days=1)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )

    # ── Article counts ────────────────────────────────────────────────────
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

    articles_last_week = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                and_(
                    NewsArticle.created_at >= two_weeks_ago,
                    NewsArticle.created_at < week_ago,
                )
            )
        )
    ).scalar_one()

    # ── FOIA counts ───────────────────────────────────────────────────────
    foia_rows = (
        await db.execute(
            select(FoiaRequest.status, func.count(FoiaRequest.id)).group_by(
                FoiaRequest.status
            )
        )
    ).all()
    foia_by_status: dict[str, int] = {row[0].value: row[1] for row in foia_rows}
    closed_statuses = {"fulfilled", "denied", "closed"}
    active_foias = sum(
        count for status, count in foia_by_status.items() if status not in closed_statuses
    )

    foias_this_week = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.created_at >= week_ago
            )
        )
    ).scalar_one()

    foias_last_week = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                and_(
                    FoiaRequest.created_at >= two_weeks_ago,
                    FoiaRequest.created_at < week_ago,
                )
            )
        )
    ).scalar_one()

    # ── Video counts ──────────────────────────────────────────────────────
    video_rows = (
        await db.execute(
            select(Video.status, func.count(Video.id)).group_by(Video.status)
        )
    ).all()
    video_by_status: dict[str, int] = {row[0].value: row[1] for row in video_rows}
    terminal_statuses = {"published", "archived"}
    videos_in_pipeline = sum(
        count for status, count in video_by_status.items() if status not in terminal_statuses
    )

    videos_this_week = (
        await db.execute(
            select(func.count(Video.id)).where(Video.created_at >= week_ago)
        )
    ).scalar_one()

    videos_last_week = (
        await db.execute(
            select(func.count(Video.id)).where(
                and_(
                    Video.created_at >= two_weeks_ago,
                    Video.created_at < week_ago,
                )
            )
        )
    ).scalar_one()

    # ── Views ─────────────────────────────────────────────────────────────
    total_views = (
        await db.execute(select(func.coalesce(func.sum(VideoAnalytics.views), 0)))
    ).scalar_one()

    views_this_week = (
        await db.execute(
            select(func.coalesce(func.sum(VideoAnalytics.views), 0)).where(
                VideoAnalytics.date >= week_ago.date()
            )
        )
    ).scalar_one()

    views_last_week = (
        await db.execute(
            select(func.coalesce(func.sum(VideoAnalytics.views), 0)).where(
                and_(
                    VideoAnalytics.date >= two_weeks_ago.date(),
                    VideoAnalytics.date < week_ago.date(),
                )
            )
        )
    ).scalar_one()

    # ── Revenue ───────────────────────────────────────────────────────────
    revenue_mtd = float(
        (
            await db.execute(
                select(func.coalesce(func.sum(RevenueTransaction.amount), 0)).where(
                    RevenueTransaction.is_income.is_(True),
                    RevenueTransaction.transaction_date >= month_start.date(),
                )
            )
        ).scalar_one()
    )

    revenue_prev_month = float(
        (
            await db.execute(
                select(func.coalesce(func.sum(RevenueTransaction.amount), 0)).where(
                    and_(
                        RevenueTransaction.is_income.is_(True),
                        RevenueTransaction.transaction_date >= prev_month_start.date(),
                        RevenueTransaction.transaction_date < month_start.date(),
                    )
                )
            )
        ).scalar_one()
    )

    # ── Trend calculations (week-over-week %) ─────────────────────────────
    def wow_trend(current: int | float, previous: int | float) -> float:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    # ── Recent articles ───────────────────────────────────────────────────
    recent_article_rows = (
        await db.execute(
            select(NewsArticle)
            .order_by(NewsArticle.created_at.desc())
            .limit(5)
        )
    ).scalars().all()

    recent_articles = [
        {
            "id": str(a.id),
            "title": a.headline,
            "source": a.source,
            "severity": (
                a.severity_score if a.severity_score and a.severity_score >= 7
                else "medium" if a.severity_score and a.severity_score >= 4
                else "low"
            ) if a.severity_score else "low",
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent_article_rows
    ]

    # ── Top videos ────────────────────────────────────────────────────────
    top_video_rows = await db.execute(
        select(
            Video.id,
            Video.title,
            Video.status,
            Video.published_at,
            func.coalesce(func.sum(VideoAnalytics.views), 0).label("total_views"),
        )
        .outerjoin(VideoAnalytics, VideoAnalytics.video_id == Video.id)
        .group_by(Video.id, Video.title, Video.status, Video.published_at)
        .order_by(func.coalesce(func.sum(VideoAnalytics.views), 0).desc())
        .limit(5)
    )

    top_videos = [
        {
            "id": str(row.id),
            "title": row.title,
            "views": int(row.total_views),
            "status": row.status.value if row.status else "unknown",
            "published_at": row.published_at.isoformat() if row.published_at else None,
        }
        for row in top_video_rows.all()
    ]

    # ── Activity feed (from notifications) ────────────────────────────────
    notification_rows = (
        await db.execute(
            select(Notification)
            .order_by(Notification.created_at.desc())
            .limit(10)
        )
    ).scalars().all()

    activities = [
        {
            "id": str(n.id),
            "type": n.type.value,
            "message": n.message or n.title,
            "timestamp": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notification_rows
    ]

    # ── Pipeline funnel ──────────────────────────────────────────────────
    total_foias = sum(foia_by_status.values())
    foias_submitted = sum(
        count for status, count in foia_by_status.items()
        if status not in {"draft", "ready"}
    )
    foias_fulfilled = foia_by_status.get("fulfilled", 0) + foia_by_status.get("partial", 0)
    total_videos = sum(video_by_status.values())
    videos_published = video_by_status.get("published", 0)

    pipeline = [
        {"stage": "Articles", "count": total_articles, "color": "#f59e0b"},
        {"stage": "FOIAs Filed", "count": total_foias, "color": "#3b82f6"},
        {"stage": "Submitted", "count": foias_submitted, "color": "#8b5cf6"},
        {"stage": "Fulfilled", "count": foias_fulfilled, "color": "#22c55e"},
        {"stage": "Videos", "count": total_videos, "color": "#06b6d4"},
        {"stage": "Published", "count": videos_published, "color": "#10b981"},
    ]

    # ── Assemble response ─────────────────────────────────────────────────
    result = {
        "stats": {
            "total_articles": total_articles,
            "active_foias": active_foias,
            "videos_in_pipeline": videos_in_pipeline,
            "total_views": int(total_views),
            "revenue_mtd": revenue_mtd,
            "articles_trend": wow_trend(articles_this_week, articles_last_week),
            "foias_trend": wow_trend(foias_this_week, foias_last_week),
            "videos_trend": wow_trend(videos_this_week, videos_last_week),
            "views_trend": wow_trend(views_this_week, views_last_week),
            "revenue_trend": wow_trend(revenue_mtd, revenue_prev_month),
        },
        "pipeline": pipeline,
        "recent_articles": recent_articles,
        "top_videos": top_videos,
        "activities": activities,
    }

    await cache_set(DASHBOARD_STATS_CACHE_KEY, result, ttl=DASHBOARD_STATS_TTL)

    return result


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get comprehensive dashboard summary with all key metrics.

    Returns today's stats, trends, top performers, and system health.
    """
    cached = await cache_get("dashboard:summary")
    if cached is not None:
        return cached

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
                    NewsArticle.severity_score >= 7,
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

    result = {
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

    await cache_set("dashboard:summary", result, ttl=120)
    return result


@router.get("/system-metrics")
async def system_metrics(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get system performance metrics and health indicators.

    Returns:
        - Database query performance
        - Redis cache statistics
        - Background task metrics
        - API usage statistics
        - Error rates
    """
    cached = await cache_get("dashboard:system-metrics")
    if cached is not None:
        return cached

    import psutil
    import os

    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(days=1)

    # Database metrics
    db_metrics = {}

    # Count total records in key tables
    articles_count = (await db.execute(select(func.count(NewsArticle.id)))).scalar() or 0
    foias_count = (await db.execute(select(func.count(FoiaRequest.id)))).scalar() or 0
    videos_count = (await db.execute(select(func.count(Video.id)))).scalar() or 0

    db_metrics["table_counts"] = {
        "articles": articles_count,
        "foias": foias_count,
        "videos": videos_count,
    }

    # Recent activity (past hour)
    articles_past_hour = (
        await db.execute(
            select(func.count(NewsArticle.id)).where(
                NewsArticle.created_at >= hour_ago
            )
        )
    ).scalar() or 0

    foias_past_hour = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.created_at >= hour_ago
            )
        )
    ).scalar() or 0

    db_metrics["recent_activity_hourly"] = {
        "articles": articles_past_hour,
        "foias": foias_past_hour,
    }

    # Redis cache metrics
    redis_metrics = {}
    try:
        from app.services.cache import get_redis
        r = await get_redis()
        info = await r.info("stats")
        redis_metrics = {
            "total_connections_received": info.get("total_connections_received", 0),
            "total_commands_processed": info.get("total_commands_processed", 0),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
            "hit_rate": (
                round(
                    info.get("keyspace_hits", 0)
                    / max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1)
                    * 100,
                    2,
                )
            ),
        }
    except Exception as e:
        redis_metrics = {"error": str(e)}

    # Background task metrics (from scan_log)
    task_metrics = {}

    # Successful scans in past 24 hours
    successful_scans = (
        await db.execute(
            select(func.count(ScanLog.id)).where(
                and_(
                    ScanLog.created_at >= day_ago,
                    ScanLog.status == "success",
                )
            )
        )
    ).scalar() or 0

    # Failed scans in past 24 hours
    failed_scans = (
        await db.execute(
            select(func.count(ScanLog.id)).where(
                and_(
                    ScanLog.created_at >= day_ago,
                    ScanLog.status == "failed",
                )
            )
        )
    ).scalar() or 0

    task_metrics["past_24h"] = {
        "successful_scans": successful_scans,
        "failed_scans": failed_scans,
        "success_rate": (
            round(
                successful_scans / max(successful_scans + failed_scans, 1) * 100,
                2,
            )
        ),
    }

    # System resources
    system_metrics = {}
    try:
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()

        system_metrics = {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_used_mb": round(memory_info.rss / 1024 / 1024, 2),
            "memory_percent": process.memory_percent(),
            "threads": process.num_threads(),
            "open_files": len(process.open_files()),
        }
    except Exception as e:
        system_metrics = {"error": str(e)}

    # Circuit breaker health
    circuit_metrics = {}
    circuits_result = await db.execute(
        select(
            func.count(NewsSourceHealth.id).label("total"),
            func.count(
                func.nullif(NewsSourceHealth.is_circuit_open, False)
            ).label("open"),
        )
    )
    circuit_row = circuits_result.first()

    circuit_metrics = {
        "total_sources": circuit_row.total if circuit_row else 0,
        "circuits_open": circuit_row.open if circuit_row else 0,
        "health_score": (
            round(
                (1 - (circuit_row.open / max(circuit_row.total, 1))) * 100,
                1,
            )
            if circuit_row and circuit_row.total > 0
            else 100
        ),
    }

    # Overall system health score (0-100)
    health_factors = []

    # Database health (based on recent activity)
    if articles_past_hour > 0 or foias_past_hour > 0:
        health_factors.append(100)  # Active
    else:
        health_factors.append(70)  # Idle

    # Redis health
    if "error" not in redis_metrics:
        health_factors.append(100)
    else:
        health_factors.append(0)

    # Task success rate
    if task_metrics["past_24h"]["success_rate"] >= 90:
        health_factors.append(100)
    elif task_metrics["past_24h"]["success_rate"] >= 70:
        health_factors.append(70)
    else:
        health_factors.append(30)

    # Circuit breaker health
    health_factors.append(circuit_metrics["health_score"])

    overall_health = round(sum(health_factors) / len(health_factors), 1)

    result = {
        "timestamp": now.isoformat(),
        "overall_health_score": overall_health,
        "database": db_metrics,
        "redis": redis_metrics,
        "background_tasks": task_metrics,
        "system_resources": system_metrics,
        "circuit_breakers": circuit_metrics,
    }

    await cache_set("dashboard:system-metrics", result, ttl=30)
    return result


@router.get("/auto-submit-stats")
async def auto_submit_stats(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Return auto-submit decision stats for today and this week."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # Current mode setting
    mode_row = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "auto_submit_mode")
        )
    ).scalar_one_or_none()
    mode = mode_row.value if mode_row else "off"

    # Daily quota setting
    quota_row = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "max_auto_submits_per_day")
        )
    ).scalar_one_or_none()
    daily_quota = int(quota_row.value) if quota_row else 5

    # Fetch all auto-submit decision audit logs for the week
    week_logs = (
        await db.execute(
            select(AuditLog).where(
                and_(
                    AuditLog.action == AuditAction.foia_auto_submit_decision,
                    AuditLog.created_at >= week_start,
                )
            )
        )
    ).scalars().all()

    # Bucket into today vs week
    today_filed = 0
    today_dry_run = 0
    today_skipped = 0
    today_skip_reasons: dict[str, int] = {}
    week_filed = 0
    week_dry_run = 0
    week_skipped = 0

    for log in week_logs:
        details = log.details or {}
        decision = details.get("decision", "")
        is_today = log.created_at >= today_start

        if decision == "filed":
            week_filed += 1
            if is_today:
                today_filed += 1
        elif decision == "dry_run":
            week_dry_run += 1
            if is_today:
                today_dry_run += 1
        elif decision == "skipped":
            week_skipped += 1
            if is_today:
                today_skipped += 1
                reason = details.get("reason", "other")
                reason_bucket = (
                    reason if reason in ("daily_quota", "agency_cooldown", "cost_cap")
                    else "other"
                )
                today_skip_reasons[reason_bucket] = (
                    today_skip_reasons.get(reason_bucket, 0) + 1
                )

    return {
        "mode": mode,
        "daily_quota": daily_quota,
        "today": {
            "filed": today_filed,
            "dry_run": today_dry_run,
            "skipped": today_skipped,
            "skip_reasons": today_skip_reasons,
            "total_evaluated": today_filed + today_dry_run + today_skipped,
        },
        "week": {
            "filed": week_filed,
            "dry_run": week_dry_run,
            "skipped": week_skipped,
            "total_evaluated": week_filed + week_dry_run + week_skipped,
        },
    }

