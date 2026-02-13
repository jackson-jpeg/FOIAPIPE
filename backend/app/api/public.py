"""Public-facing endpoints — no authentication required.

Provides transparency data for the public accountability dashboard at foiaarchive.com.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.agency import Agency
from app.models.foia_request import FoiaRequest, FoiaStatus
from app.services.cache import cache_get, cache_set

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
async def public_stats(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Public aggregate FOIA statistics — no auth required."""
    cached = await cache_get("public:stats")
    if cached is not None:
        return cached

    # Total FOIAs filed
    total_filed = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.status != FoiaStatus.draft
            )
        )
    ).scalar_one()

    # Fulfillment rate
    fulfilled = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.status.in_([FoiaStatus.fulfilled])
            )
        )
    ).scalar_one()

    denied = (
        await db.execute(
            select(func.count(FoiaRequest.id)).where(
                FoiaRequest.status == FoiaStatus.denied
            )
        )
    ).scalar_one()

    resolved = fulfilled + denied
    fulfillment_rate = round((fulfilled / max(resolved, 1)) * 100, 1)

    # Average response time (days)
    avg_response = (
        await db.execute(
            select(
                func.avg(
                    extract("epoch", FoiaRequest.fulfilled_at)
                    - extract("epoch", FoiaRequest.submitted_at)
                )
            ).where(
                FoiaRequest.submitted_at.isnot(None),
                FoiaRequest.fulfilled_at.isnot(None),
            )
        )
    ).scalar_one()
    avg_response_days = round(float(avg_response or 0) / 86400, 1)

    # Monthly trends (last 6 months)
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    monthly_stmt = (
        select(
            extract("year", FoiaRequest.created_at).label("year"),
            extract("month", FoiaRequest.created_at).label("month"),
            func.count(FoiaRequest.id).label("filed"),
            func.count(case((FoiaRequest.status == FoiaStatus.fulfilled, 1))).label("fulfilled"),
            func.count(case((FoiaRequest.status == FoiaStatus.denied, 1))).label("denied"),
        )
        .where(FoiaRequest.created_at >= six_months_ago)
        .group_by("year", "month")
        .order_by("year", "month")
    )
    monthly_rows = (await db.execute(monthly_stmt)).all()
    monthly_trends = [
        {
            "month": f"{int(row.year)}-{int(row.month):02d}",
            "filed": row.filed,
            "fulfilled": row.fulfilled,
            "denied": row.denied,
        }
        for row in monthly_rows
    ]

    # Agency count
    agency_count = (await db.execute(select(func.count(Agency.id)).where(Agency.is_active == True))).scalar_one()

    # Recent filings (last 10, redacted)
    recent = (
        await db.execute(
            select(
                FoiaRequest.case_number,
                FoiaRequest.status,
                FoiaRequest.created_at,
                Agency.name.label("agency_name"),
            )
            .join(Agency, Agency.id == FoiaRequest.agency_id, isouter=True)
            .where(FoiaRequest.status != FoiaStatus.draft)
            .order_by(FoiaRequest.created_at.desc())
            .limit(10)
        )
    ).all()

    recent_filings = [
        {
            "case_number": row.case_number,
            "status": row.status.value if row.status else None,
            "agency": row.agency_name,
            "filed_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in recent
    ]

    result = {
        "total_filed": total_filed,
        "fulfillment_rate": fulfillment_rate,
        "avg_response_days": avg_response_days,
        "agency_count": agency_count,
        "denied_count": denied,
        "monthly_trends": monthly_trends,
        "recent_filings": recent_filings,
    }
    await cache_set("public:stats", result, ttl=300)  # 5 minute cache for public data
    return result


@router.get("/agency-report-cards")
async def agency_report_cards(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Per-agency letter grades — no auth required."""
    cached = await cache_get("public:agency-report-cards")
    if cached is not None:
        return cached

    agencies = (
        await db.execute(
            select(
                Agency.id,
                Agency.name,
                Agency.abbreviation,
                Agency.report_card_grade,
                Agency.report_card_updated_at,
            )
            .where(Agency.is_active == True)
            .order_by(Agency.name)
        )
    ).all()

    # Also get request counts per agency
    agency_stats = (
        await db.execute(
            select(
                FoiaRequest.agency_id,
                func.count(FoiaRequest.id).label("total"),
                func.count(case((FoiaRequest.status == FoiaStatus.fulfilled, 1))).label("fulfilled"),
                func.count(case((FoiaRequest.status == FoiaStatus.denied, 1))).label("denied"),
            )
            .where(FoiaRequest.status != FoiaStatus.draft)
            .group_by(FoiaRequest.agency_id)
        )
    ).all()

    stats_map = {str(row.agency_id): row for row in agency_stats}

    cards = []
    for agency in agencies:
        stats = stats_map.get(str(agency.id))
        total = stats.total if stats else 0
        fulfilled = stats.fulfilled if stats else 0
        denied = stats.denied if stats else 0

        cards.append({
            "id": str(agency.id),
            "name": agency.name,
            "abbreviation": agency.abbreviation,
            "grade": agency.report_card_grade or "N/A",
            "total_requests": total,
            "fulfilled": fulfilled,
            "denied": denied,
            "fulfillment_rate": round((fulfilled / max(total, 1)) * 100, 1),
            "updated_at": agency.report_card_updated_at.isoformat() if agency.report_card_updated_at else None,
        })

    result = {"agencies": cards, "total": len(cards)}
    await cache_set("public:agency-report-cards", result, ttl=300)
    return result
