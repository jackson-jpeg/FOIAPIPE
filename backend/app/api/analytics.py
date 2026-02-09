"""Analytics and revenue endpoints."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
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

    return {
        "total_views": total_views,
        "total_revenue": round(total_revenue, 2),
        "total_subscribers": int(subs) if subs else 0,
        "avg_rpm": round(avg_rpm, 2),
        "period_views": total_views,
        "period_revenue": round(total_revenue, 2),
        "trends": {
            "views": _calc_trend(int(views), int(prev_views)),
            "revenue": _calc_trend(float(revenue), float(prev_revenue)),
        },
    }


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
