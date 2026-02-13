"""Agency grading service — computes letter grades (A-F) for FOIA responsiveness.

Grades are based on:
- Response time vs. statutory deadline (Florida: 30 days)
- Fulfillment rate
- Cost reasonableness
- Appeal success rate
- Trend (improving vs degrading)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.foia_request import FoiaRequest, FoiaStatus

logger = logging.getLogger(__name__)

STATUTORY_DEADLINE_DAYS = 30  # Florida statutory deadline


async def compute_agency_grade(db: AsyncSession, agency_id: str) -> dict:
    """Compute a letter grade for an agency based on FOIA performance.

    Returns dict with grade, score (0-100), and breakdown.
    """
    # Get all requests for this agency (excluding drafts)
    total_result = await db.execute(
        select(func.count(FoiaRequest.id))
        .where(FoiaRequest.agency_id == agency_id, FoiaRequest.status != FoiaStatus.draft)
    )
    total = total_result.scalar_one()

    if total < 2:
        return {"grade": "N/A", "score": None, "reason": "Insufficient data (< 2 requests)"}

    # 1. Fulfillment rate (0-30 points)
    fulfilled = (await db.execute(
        select(func.count(FoiaRequest.id)).where(
            FoiaRequest.agency_id == agency_id,
            FoiaRequest.status == FoiaStatus.fulfilled,
        )
    )).scalar_one()
    denied = (await db.execute(
        select(func.count(FoiaRequest.id)).where(
            FoiaRequest.agency_id == agency_id,
            FoiaRequest.status == FoiaStatus.denied,
        )
    )).scalar_one()

    resolved = fulfilled + denied
    fulfillment_rate = (fulfilled / max(resolved, 1)) * 100
    fulfillment_points = (fulfillment_rate / 100) * 30

    # 2. Response time (0-30 points)
    avg_response_result = await db.execute(
        select(
            func.avg(
                extract("epoch", FoiaRequest.fulfilled_at)
                - extract("epoch", FoiaRequest.submitted_at)
            )
        ).where(
            FoiaRequest.agency_id == agency_id,
            FoiaRequest.submitted_at.isnot(None),
            FoiaRequest.fulfilled_at.isnot(None),
        )
    )
    avg_response_seconds = avg_response_result.scalar_one()
    avg_response_days = (float(avg_response_seconds or 0) / 86400) if avg_response_seconds else None

    if avg_response_days is not None:
        # Perfect score if under 10 days, 0 if over 60
        if avg_response_days <= 10:
            response_points = 30
        elif avg_response_days <= STATUTORY_DEADLINE_DAYS:
            response_points = 30 * (1 - (avg_response_days - 10) / 20)
        elif avg_response_days <= 60:
            response_points = 15 * (1 - (avg_response_days - 30) / 30)
        else:
            response_points = 0
    else:
        response_points = 10  # Partial credit for unknown

    # 3. Cost reasonableness (0-20 points)
    avg_cost_result = await db.execute(
        select(func.avg(FoiaRequest.actual_cost)).where(
            FoiaRequest.agency_id == agency_id,
            FoiaRequest.actual_cost.isnot(None),
        )
    )
    avg_cost = avg_cost_result.scalar_one()
    if avg_cost is not None:
        avg_cost_f = float(avg_cost)
        if avg_cost_f <= 5:
            cost_points = 20
        elif avg_cost_f <= 25:
            cost_points = 20 * (1 - (avg_cost_f - 5) / 20)
        elif avg_cost_f <= 100:
            cost_points = 10 * (1 - (avg_cost_f - 25) / 75)
        else:
            cost_points = 0
    else:
        cost_points = 15  # Default: no fees charged (good)

    # 4. Denial rate penalty (0-20 points, inverse)
    denial_rate = (denied / max(total, 1)) * 100
    denial_points = max(0, 20 * (1 - denial_rate / 50))

    # Total score
    score = round(fulfillment_points + response_points + cost_points + denial_points)
    score = max(0, min(100, score))

    # Assign grade
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 65:
        grade = "C"
    elif score >= 50:
        grade = "D"
    else:
        grade = "F"

    return {
        "grade": grade,
        "score": score,
        "breakdown": {
            "fulfillment_points": round(fulfillment_points, 1),
            "response_points": round(response_points, 1),
            "cost_points": round(cost_points, 1),
            "denial_points": round(denial_points, 1),
        },
        "metrics": {
            "total_requests": total,
            "fulfillment_rate": round(fulfillment_rate, 1),
            "avg_response_days": round(avg_response_days, 1) if avg_response_days else None,
            "denial_rate": round(denial_rate, 1),
            "avg_cost": round(float(avg_cost), 2) if avg_cost else None,
        },
    }


async def recalculate_all_grades(db: AsyncSession) -> dict:
    """Recalculate report card grades for all active agencies."""
    agencies = (
        await db.execute(select(Agency).where(Agency.is_active == True))
    ).scalars().all()

    results = {"updated": 0, "skipped": 0, "errors": 0}
    now = datetime.now(timezone.utc)

    for agency in agencies:
        try:
            result = await compute_agency_grade(db, str(agency.id))
            if result["grade"] != "N/A":
                agency.report_card_grade = result["grade"]
                agency.report_card_updated_at = now
                results["updated"] += 1
            else:
                results["skipped"] += 1
        except Exception as e:
            logger.error(f"Grade computation failed for {agency.name}: {e}")
            results["errors"] += 1

    await db.flush()
    return results
