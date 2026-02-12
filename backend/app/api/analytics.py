"""Analytics and revenue endpoints."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.services.cache import cache_get, cache_set
from app.models.video import Video, VideoStatus
from app.models.video_analytics import VideoAnalytics
from app.models.revenue_transaction import RevenueTransaction, TransactionType
from app.models.news_article import NewsArticle
from app.models.foia_request import FoiaRequest

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _get_date_range(range_str: str) -> tuple[date, date]:
    """Convert range string to start/end dates."""
    today = date.today()
    ranges = {
        "7d": today - timedelta(days=7),
        "30d": today - timedelta(days=30),
        "90d": today - timedelta(days=90),
        "ytd": date(today.year, 1, 1),
        "all": date(2020, 1, 1),
    }
    start = ranges.get(range_str, ranges["30d"])
    return start, today


@router.get("/overview")
async def analytics_overview(
    range: str = Query("30d"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cache_key = f"analytics:overview:{range}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    start, end = _get_date_range(range)
    prev_start = start - (end - start)

    # Current period
    current = await db.execute(
        select(
            func.coalesce(func.sum(VideoAnalytics.views), 0),
            func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0),
            func.coalesce(func.sum(VideoAnalytics.subscribers_gained - VideoAnalytics.subscribers_lost), 0),
        ).where(VideoAnalytics.date.between(start, end))
    )
    views, revenue, subs = current.one()

    # Previous period for trends
    prev = await db.execute(
        select(
            func.coalesce(func.sum(VideoAnalytics.views), 0),
            func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0),
        ).where(VideoAnalytics.date.between(prev_start, start))
    )
    prev_views, prev_revenue = prev.one()

    # RPM calculation
    total_views = int(views) if views else 0
    total_revenue = float(revenue) if revenue else 0
    avg_rpm = (total_revenue / total_views * 1000) if total_views > 0 else 0

    # Total costs (FOIA + expenses)
    foia_cost_result = await db.execute(
        select(func.coalesce(func.sum(FoiaRequest.actual_cost), 0))
    )
    expense_result = await db.execute(
        select(func.coalesce(func.sum(RevenueTransaction.amount), 0))
        .where(RevenueTransaction.is_income == False)
    )
    total_costs = float(foia_cost_result.scalar() or 0) + float(expense_result.scalar() or 0)

    result = {
        "total_views": total_views,
        "total_revenue": round(total_revenue, 2),
        "total_costs": round(total_costs, 2),
        "total_subscribers": int(subs) if subs else 0,
        "avg_rpm": round(avg_rpm, 2),
        "period_views": total_views,
        "period_revenue": round(total_revenue, 2),
        "trends": {
            "views": _calc_trend(int(views), int(prev_views)),
            "revenue": _calc_trend(float(revenue), float(prev_revenue)),
        },
    }
    await cache_set(cache_key, result, ttl=120)
    return result


@router.get("/revenue")
async def revenue_timeseries(
    range: str = Query("30d"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    result = await db.execute(
        select(VideoAnalytics.date, func.sum(VideoAnalytics.estimated_revenue))
        .where(VideoAnalytics.date.between(start, end))
        .group_by(VideoAnalytics.date)
        .order_by(VideoAnalytics.date)
    )
    return {"data": [{"date": str(row[0]), "value": float(row[1])} for row in result.all()]}


@router.get("/views")
async def views_timeseries(
    range: str = Query("30d"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    result = await db.execute(
        select(VideoAnalytics.date, func.sum(VideoAnalytics.views))
        .where(VideoAnalytics.date.between(start, end))
        .group_by(VideoAnalytics.date)
        .order_by(VideoAnalytics.date)
    )
    return {"data": [{"date": str(row[0]), "value": int(row[1])} for row in result.all()]}


@router.get("/top-videos")
async def top_videos(
    range: str = Query("30d"),
    sort: str = Query("views"),
    limit: int = Query(10),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    sort_col = {
        "views": func.sum(VideoAnalytics.views),
        "revenue": func.sum(VideoAnalytics.estimated_revenue),
        "engagement": func.sum(VideoAnalytics.likes + VideoAnalytics.comments + VideoAnalytics.shares),
    }.get(sort, func.sum(VideoAnalytics.views))

    result = await db.execute(
        select(
            Video.id, Video.title, Video.thumbnail_storage_key, Video.published_at,
            func.sum(VideoAnalytics.views).label("views"),
            func.sum(VideoAnalytics.estimated_revenue).label("revenue"),
            func.avg(VideoAnalytics.ctr).label("ctr"),
        )
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id)
        .where(VideoAnalytics.date.between(start, end))
        .group_by(Video.id, Video.title, Video.thumbnail_storage_key, Video.published_at)
        .order_by(sort_col.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": str(row.id),
            "title": row.title,
            "thumbnail_url": f"/api/videos/{row.id}/thumbnail" if row.thumbnail_storage_key else None,
            "views": int(row.views or 0),
            "revenue": round(float(row.revenue or 0), 2),
            "rpm": round(float(row.revenue or 0) / max(int(row.views or 1), 1) * 1000, 2),
            "ctr": round(float(row.ctr or 0), 2),
            "published_at": str(row.published_at) if row.published_at else None,
        }
        for row in rows
    ]


@router.get("/by-agency")
async def by_agency(
    range: str = Query("30d"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    result = await db.execute(
        select(
            NewsArticle.detected_agency,
            func.count(Video.id.distinct()),
            func.coalesce(func.sum(VideoAnalytics.views), 0),
            func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0),
        )
        .select_from(Video)
        .join(FoiaRequest, Video.foia_request_id == FoiaRequest.id, isouter=True)
        .join(NewsArticle, FoiaRequest.news_article_id == NewsArticle.id, isouter=True)
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id, isouter=True)
        .where(VideoAnalytics.date.between(start, end))
        .group_by(NewsArticle.detected_agency)
        .having(NewsArticle.detected_agency.isnot(None))
    )
    return [
        {"agency_name": row[0], "video_count": row[1], "total_views": int(row[2]), "total_revenue": round(float(row[3]), 2)}
        for row in result.all()
    ]


@router.get("/by-incident-type")
async def by_incident_type(
    range: str = Query("30d"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    result = await db.execute(
        select(
            NewsArticle.incident_type,
            func.count(Video.id.distinct()),
            func.coalesce(func.sum(VideoAnalytics.views), 0),
            func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0),
        )
        .select_from(Video)
        .join(FoiaRequest, Video.foia_request_id == FoiaRequest.id, isouter=True)
        .join(NewsArticle, FoiaRequest.news_article_id == NewsArticle.id, isouter=True)
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id, isouter=True)
        .where(VideoAnalytics.date.between(start, end))
        .group_by(NewsArticle.incident_type)
        .having(NewsArticle.incident_type.isnot(None))
    )
    return [
        {"incident_type": row[0], "video_count": row[1], "total_views": int(row[2]), "total_revenue": round(float(row[3]), 2)}
        for row in result.all()
    ]


@router.get("/funnel")
async def pipeline_funnel(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    articles = (await db.execute(select(func.count(NewsArticle.id)))).scalar() or 0
    foias = (await db.execute(select(func.count(FoiaRequest.id)))).scalar() or 0
    videos = (await db.execute(select(func.count(Video.id)))).scalar() or 0
    published = (await db.execute(
        select(func.count(Video.id)).where(Video.status == VideoStatus.published)
    )).scalar() or 0
    profitable = (await db.execute(
        select(func.count(Video.id.distinct()))
        .join(VideoAnalytics)
        .where(VideoAnalytics.estimated_revenue > 0)
    )).scalar() or 0

    steps = [
        {"label": "Articles Discovered", "count": articles},
        {"label": "FOIAs Filed", "count": foias, "conversion_rate": round(foias / max(articles, 1) * 100, 1)},
        {"label": "Videos Created", "count": videos, "conversion_rate": round(videos / max(foias, 1) * 100, 1)},
        {"label": "Published", "count": published, "conversion_rate": round(published / max(videos, 1) * 100, 1)},
        {"label": "Profitable", "count": profitable, "conversion_rate": round(profitable / max(published, 1) * 100, 1)},
    ]
    return {"steps": steps}


@router.get("/pipeline-velocity")
async def pipeline_velocity(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    # Average days between article discovery and FOIA filing
    result = await db.execute(
        select(func.avg(func.extract("epoch", FoiaRequest.created_at - NewsArticle.created_at) / 86400))
        .join(NewsArticle, FoiaRequest.news_article_id == NewsArticle.id)
        .where(FoiaRequest.news_article_id.isnot(None))
    )
    article_to_foia = result.scalar()

    # Average days from FOIA submission to fulfillment
    result = await db.execute(
        select(func.avg(func.extract("epoch", FoiaRequest.fulfilled_at - FoiaRequest.submitted_at) / 86400))
        .where(FoiaRequest.fulfilled_at.isnot(None), FoiaRequest.submitted_at.isnot(None))
    )
    foia_to_fulfill = result.scalar()

    # Average days from video creation to publishing
    result = await db.execute(
        select(func.avg(func.extract("epoch", Video.published_at - Video.created_at) / 86400))
        .where(Video.published_at.isnot(None))
    )
    video_to_publish = result.scalar()

    return [
        {"stage": "Article -> FOIA", "avg_days": round(float(article_to_foia or 0), 1)},
        {"stage": "FOIA -> Fulfilled", "avg_days": round(float(foia_to_fulfill or 0), 1)},
        {"stage": "Video -> Published", "avg_days": round(float(video_to_publish or 0), 1)},
    ]


@router.get("/roi")
async def roi_analysis(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    result = await db.execute(
        select(
            FoiaRequest.id, FoiaRequest.case_number, FoiaRequest.actual_cost,
            func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0).label("revenue"),
        )
        .join(Video, Video.foia_request_id == FoiaRequest.id, isouter=True)
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id, isouter=True)
        .group_by(FoiaRequest.id, FoiaRequest.case_number, FoiaRequest.actual_cost)
        .having(func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0) > 0)
        .order_by(func.sum(VideoAnalytics.estimated_revenue).desc())
        .limit(20)
    )
    return [
        {
            "foia_id": str(row.id),
            "case_number": row.case_number,
            "cost": float(row.actual_cost or 0),
            "revenue": round(float(row.revenue), 2),
            "roi": round((float(row.revenue) - float(row.actual_cost or 0)) / max(float(row.actual_cost or 1), 0.01) * 100, 1),
        }
        for row in result.all()
    ]


# Revenue endpoints
@router.get("/revenue/transactions")
async def revenue_transactions(
    range: str = Query("30d"),
    type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    stmt = select(RevenueTransaction).where(RevenueTransaction.transaction_date.between(start, end))
    count_stmt = select(func.count(RevenueTransaction.id)).where(RevenueTransaction.transaction_date.between(start, end))

    if type:
        stmt = stmt.where(RevenueTransaction.transaction_type == type)
        count_stmt = count_stmt.where(RevenueTransaction.transaction_type == type)

    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(
        stmt.order_by(RevenueTransaction.transaction_date.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": str(t.id),
                "transaction_type": t.transaction_type.value if hasattr(t.transaction_type, 'value') else t.transaction_type,
                "amount": float(t.amount),
                "description": t.description,
                "transaction_date": str(t.transaction_date),
                "is_income": t.is_income,
                "video_id": str(t.video_id) if t.video_id else None,
                "foia_request_id": str(t.foia_request_id) if t.foia_request_id else None,
            }
            for t in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/revenue/transactions")
async def create_transaction(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    from datetime import date as date_type
    txn = RevenueTransaction(
        transaction_type=payload["transaction_type"],
        amount=payload["amount"],
        description=payload.get("description"),
        transaction_date=date_type.fromisoformat(payload["transaction_date"]),
        is_income=payload["is_income"],
        video_id=payload.get("video_id"),
        foia_request_id=payload.get("foia_request_id"),
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return {"id": str(txn.id), "created": True}


@router.get("/revenue/summary")
async def revenue_summary(
    range: str = Query("30d"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    start, end = _get_date_range(range)
    result = await db.execute(
        select(
            func.coalesce(func.sum(case((RevenueTransaction.is_income == True, RevenueTransaction.amount), else_=0)), 0),
            func.coalesce(func.sum(case((RevenueTransaction.is_income == False, RevenueTransaction.amount), else_=0)), 0),
        ).where(RevenueTransaction.transaction_date.between(start, end))
    )
    income, expenses = result.one()
    income = float(income)
    expenses = float(expenses)

    # FOIA costs
    foia_costs = (await db.execute(
        select(func.coalesce(func.sum(FoiaRequest.actual_cost), 0))
    )).scalar()

    published_count = (await db.execute(
        select(func.count(Video.id)).where(Video.status == VideoStatus.published)
    )).scalar() or 1

    return {
        "gross_income": round(income, 2),
        "total_expenses": round(expenses, 2),
        "net_profit": round(income - expenses, 2),
        "foia_costs": round(float(foia_costs or 0), 2),
        "per_video_avg": round(income / max(published_count, 1), 2),
    }


def _calc_trend(current: float, previous: float) -> dict:
    if previous == 0:
        return {"value": 0, "is_positive": True}
    change = ((current - previous) / previous) * 100
    return {"value": round(abs(change), 1), "is_positive": change >= 0}


@router.get("/publishing/optimal-times")
async def get_optimal_publish_times(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get optimal publishing times based on historical performance."""
    from app.services.publish_scheduler import analyze_best_publish_times

    analysis = await analyze_best_publish_times(db)
    return analysis


@router.get("/publishing/recommendations")
async def get_publishing_recommendations(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get publishing recommendations for videos ready to upload."""
    from app.services.publish_scheduler import get_publish_recommendations

    recommendations = await get_publish_recommendations(db)
    return recommendations


@router.get("/foia/performance")
async def foia_performance_by_agency(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Agency performance metrics: response rate, avg time, cost, denial rate."""
    from app.models.agency import Agency
    from app.models.foia_request import FoiaStatus

    result = await db.execute(
        select(
            Agency.name,
            func.count(FoiaRequest.id).label("total_requests"),
            func.count(case((FoiaRequest.status == FoiaStatus.fulfilled, 1))).label("fulfilled"),
            func.count(case((FoiaRequest.status == FoiaStatus.denied, 1))).label("denied"),
            func.avg(
                func.extract("epoch", FoiaRequest.fulfilled_at - FoiaRequest.submitted_at) / 86400
            ).label("avg_days"),
            func.coalesce(func.avg(FoiaRequest.actual_cost), 0).label("avg_cost"),
        )
        .join(FoiaRequest, FoiaRequest.agency_id == Agency.id, isouter=True)
        .where(FoiaRequest.id.isnot(None))
        .group_by(Agency.name)
        .order_by(func.count(FoiaRequest.id).desc())
    )

    return [
        {
            "agency_name": row.name,
            "total_requests": row.total_requests,
            "fulfilled": row.fulfilled,
            "denied": row.denied,
            "response_rate": round((row.fulfilled / max(row.total_requests, 1)) * 100, 1),
            "denial_rate": round((row.denied / max(row.total_requests, 1)) * 100, 1),
            "avg_days_to_fulfill": round(float(row.avg_days or 0), 1),
            "avg_cost": round(float(row.avg_cost), 2),
        }
        for row in result.all()
    ]


@router.get("/agency-response")
async def agency_response_analytics(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Detailed per-agency FOIA response analytics.

    Returns per-agency metrics including:
    - Status breakdown (count per status)
    - Cost statistics (min, max, avg, total)
    - Response time statistics
    - Total linked videos and revenue
    """
    from app.models.agency import Agency
    from app.models.foia_request import FoiaStatus

    # Per-agency aggregated metrics
    result = await db.execute(
        select(
            Agency.id,
            Agency.name,
            Agency.abbreviation,
            func.count(FoiaRequest.id).label("total_requests"),
            func.count(case((FoiaRequest.status == FoiaStatus.fulfilled, 1))).label("fulfilled"),
            func.count(case((FoiaRequest.status == FoiaStatus.partial, 1))).label("partial"),
            func.count(case((FoiaRequest.status == FoiaStatus.denied, 1))).label("denied"),
            func.count(case((FoiaRequest.status == FoiaStatus.submitted, 1))).label("pending"),
            func.count(case((FoiaRequest.status == FoiaStatus.processing, 1))).label("processing"),
            func.count(case((FoiaRequest.status == FoiaStatus.acknowledged, 1))).label("acknowledged"),
            func.avg(
                func.extract("epoch", FoiaRequest.fulfilled_at - FoiaRequest.submitted_at) / 86400
            ).label("avg_days"),
            func.min(
                func.extract("epoch", FoiaRequest.fulfilled_at - FoiaRequest.submitted_at) / 86400
            ).label("min_days"),
            func.max(
                func.extract("epoch", FoiaRequest.fulfilled_at - FoiaRequest.submitted_at) / 86400
            ).label("max_days"),
            func.coalesce(func.avg(FoiaRequest.actual_cost), 0).label("avg_cost"),
            func.coalesce(func.min(FoiaRequest.actual_cost), 0).label("min_cost"),
            func.coalesce(func.max(FoiaRequest.actual_cost), 0).label("max_cost"),
            func.coalesce(func.sum(FoiaRequest.actual_cost), 0).label("total_cost"),
        )
        .join(FoiaRequest, FoiaRequest.agency_id == Agency.id, isouter=True)
        .where(FoiaRequest.id.isnot(None))
        .group_by(Agency.id, Agency.name, Agency.abbreviation)
        .order_by(func.count(FoiaRequest.id).desc())
    )

    agencies = []
    for row in result.all():
        total = row.total_requests or 0
        fulfilled = (row.fulfilled or 0) + (row.partial or 0)
        denied = row.denied or 0

        # Video count and revenue for this agency
        video_result = await db.execute(
            select(
                func.count(Video.id.distinct()).label("video_count"),
                func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0).label("revenue"),
            )
            .join(FoiaRequest, Video.foia_request_id == FoiaRequest.id)
            .join(VideoAnalytics, VideoAnalytics.video_id == Video.id, isouter=True)
            .where(FoiaRequest.agency_id == row.id)
        )
        video_row = video_result.one()

        agencies.append({
            "agency_id": str(row.id),
            "agency_name": row.name,
            "abbreviation": row.abbreviation,
            "total_requests": total,
            "status_breakdown": {
                "fulfilled": row.fulfilled or 0,
                "partial": row.partial or 0,
                "denied": denied,
                "pending": row.pending or 0,
                "processing": row.processing or 0,
                "acknowledged": row.acknowledged or 0,
            },
            "fulfillment_rate": round(fulfilled / max(total, 1) * 100, 1),
            "denial_rate": round(denied / max(total, 1) * 100, 1),
            "response_time": {
                "avg_days": round(float(row.avg_days or 0), 1),
                "min_days": round(float(row.min_days or 0), 1),
                "max_days": round(float(row.max_days or 0), 1),
            },
            "cost": {
                "avg": round(float(row.avg_cost), 2),
                "min": round(float(row.min_cost), 2),
                "max": round(float(row.max_cost), 2),
                "total": round(float(row.total_cost), 2),
            },
            "videos": {
                "count": video_row.video_count or 0,
                "total_revenue": round(float(video_row.revenue or 0), 2),
            },
        })

    return agencies


@router.get("/videos/profitability")
async def video_profitability_ranking(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Rank videos by net profit (revenue - FOIA cost)."""
    result = await db.execute(
        select(
            Video.id,
            Video.title,
            Video.published_at,
            FoiaRequest.actual_cost,
            func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0).label("revenue"),
        )
        .join(FoiaRequest, Video.foia_request_id == FoiaRequest.id, isouter=True)
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id, isouter=True)
        .where(Video.status == VideoStatus.published)
        .group_by(Video.id, Video.title, Video.published_at, FoiaRequest.actual_cost)
        .order_by((func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0) - func.coalesce(FoiaRequest.actual_cost, 0)).desc())
        .limit(50)
    )

    return [
        {
            "video_id": str(row.id),
            "title": row.title,
            "published_at": str(row.published_at) if row.published_at else None,
            "foia_cost": round(float(row.actual_cost or 0), 2),
            "revenue": round(float(row.revenue), 2),
            "net_profit": round(float(row.revenue) - float(row.actual_cost or 0), 2),
            "roi_percent": round(
                ((float(row.revenue) - float(row.actual_cost or 0)) / max(float(row.actual_cost or 1), 0.01)) * 100,
                1
            ) if row.actual_cost else None,
        }
        for row in result.all()
    ]


@router.get("/revenue/break-even")
async def break_even_analysis(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Calculate break-even metrics and runway."""
    # Get total revenue from video analytics
    total_revenue_result = await db.execute(
        select(func.coalesce(func.sum(VideoAnalytics.estimated_revenue), 0))
    )
    total_revenue = float(total_revenue_result.scalar() or 0)

    # Get total expenses from revenue transactions
    expenses_result = await db.execute(
        select(func.coalesce(func.sum(RevenueTransaction.amount), 0))
        .where(RevenueTransaction.is_income == False)
    )
    total_expenses = float(expenses_result.scalar() or 0)

    # Get FOIA costs specifically
    foia_costs_result = await db.execute(
        select(func.coalesce(func.sum(FoiaRequest.actual_cost), 0))
    )
    foia_costs = float(foia_costs_result.scalar() or 0)

    # Count profitable vs unprofitable videos
    profitable_videos = await db.execute(
        select(func.count(Video.id.distinct()))
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id)
        .join(FoiaRequest, Video.foia_request_id == FoiaRequest.id, isouter=True)
        .where(
            func.coalesce(VideoAnalytics.estimated_revenue, 0) > func.coalesce(FoiaRequest.actual_cost, 0)
        )
    )
    profitable_count = profitable_videos.scalar() or 0

    total_videos = (await db.execute(
        select(func.count(Video.id)).where(Video.status == VideoStatus.published)
    )).scalar() or 0

    return {
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "foia_costs": round(foia_costs, 2),
        "net_profit": round(total_revenue - total_expenses, 2),
        "profitable_videos": profitable_count,
        "total_videos": total_videos,
        "profitability_rate": round((profitable_count / max(total_videos, 1)) * 100, 1),
        "avg_cost_per_video": round(foia_costs / max(total_videos, 1), 2),
        "avg_revenue_per_video": round(total_revenue / max(total_videos, 1), 2),
        "break_even_at": "N/A" if total_revenue >= total_expenses else f"Need ${round(total_expenses - total_revenue, 2)} more revenue",
    }
