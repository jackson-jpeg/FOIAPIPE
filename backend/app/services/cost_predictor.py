"""Predict FOIA request costs based on historical data and incident characteristics."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.foia_request import FoiaRequest
from app.models.news_article import IncidentType
from app.models.agency import Agency

logger = logging.getLogger(__name__)


# Default cost estimates by incident type (in dollars)
# Based on typical bodycam footage duration
DEFAULT_COSTS_BY_TYPE = {
    IncidentType.ois: 50.0,  # Officer-involved shooting - longer footage
    IncidentType.use_of_force: 30.0,  # Use of force - moderate footage
    IncidentType.pursuit: 40.0,  # Vehicle pursuit - can be lengthy
    IncidentType.taser: 25.0,  # Taser deployment - moderate
    IncidentType.k9: 25.0,  # K-9 deployment - moderate
    IncidentType.arrest: 15.0,  # Standard arrest - shorter footage
    IncidentType.dui: 20.0,  # DUI - moderate footage (field tests)
    "other": 20.0,
}


async def get_agency_avg_cost(
    db: AsyncSession,
    agency_id: str,
) -> Optional[Decimal]:
    """Get average actual cost for fulfilled FOIAs from this agency."""
    result = await db.execute(
        select(func.avg(FoiaRequest.actual_cost))
        .where(
            and_(
                FoiaRequest.agency_id == agency_id,
                FoiaRequest.actual_cost.isnot(None),
                FoiaRequest.actual_cost > 0,
            )
        )
    )
    avg_cost = result.scalar()
    return avg_cost if avg_cost else None


async def get_incident_type_avg_cost(
    db: AsyncSession,
    incident_type: IncidentType,
) -> Optional[Decimal]:
    """Get average cost for FOIAs of this incident type."""
    from app.models.news_article import NewsArticle

    result = await db.execute(
        select(func.avg(FoiaRequest.actual_cost))
        .join(NewsArticle, FoiaRequest.news_article_id == NewsArticle.id)
        .where(
            and_(
                NewsArticle.incident_type == incident_type,
                FoiaRequest.actual_cost.isnot(None),
                FoiaRequest.actual_cost > 0,
            )
        )
    )
    avg_cost = result.scalar()
    return avg_cost if avg_cost else None


async def predict_foia_cost(
    db: AsyncSession,
    agency_id: str,
    incident_type: Optional[IncidentType] = None,
    estimated_duration_minutes: Optional[int] = None,
) -> dict:
    """Predict the cost of a FOIA request.

    Uses multiple data sources in priority order:
    1. Agency-specific historical average
    2. Incident type historical average
    3. Agency's typical cost per hour
    4. Default estimates by incident type

    Args:
        db: Database session
        agency_id: Target agency UUID
        incident_type: Type of incident (optional)
        estimated_duration_minutes: Estimated footage duration (optional)

    Returns:
        Dict with prediction, confidence, and breakdown
    """
    # Get agency info
    agency = await db.get(Agency, agency_id)
    if not agency:
        return {
            "estimated_cost": 0.0,
            "confidence": "low",
            "method": "unknown_agency",
            "range_low": 0.0,
            "range_high": 100.0,
        }

    # Collect all available estimates
    estimates = []
    methods = []

    # 1. Agency-specific historical average (highest confidence)
    agency_avg = await get_agency_avg_cost(db, agency_id)
    if agency_avg:
        estimates.append(float(agency_avg))
        methods.append(f"agency_avg:${float(agency_avg):.2f}")

    # 2. Incident type historical average
    if incident_type:
        type_avg = await get_incident_type_avg_cost(db, incident_type)
        if type_avg:
            estimates.append(float(type_avg))
            methods.append(f"type_avg:${float(type_avg):.2f}")

    # 3. Agency's typical cost per hour (if duration estimated)
    if estimated_duration_minutes and agency.typical_cost_per_hour:
        hours = estimated_duration_minutes / 60.0
        hourly_estimate = float(agency.typical_cost_per_hour) * hours
        estimates.append(hourly_estimate)
        methods.append(f"hourly_rate:${hourly_estimate:.2f}")

    # 4. Default estimate by incident type
    if incident_type:
        default_cost = DEFAULT_COSTS_BY_TYPE.get(
            incident_type,
            DEFAULT_COSTS_BY_TYPE["other"]
        )
        estimates.append(default_cost)
        methods.append(f"default:${default_cost:.2f}")

    # If no estimates available, use conservative default
    if not estimates:
        return {
            "estimated_cost": 25.0,
            "confidence": "low",
            "method": "fallback_default",
            "range_low": 0.0,
            "range_high": 100.0,
            "notes": "No historical data available",
        }

    # Calculate weighted average (give more weight to historical data)
    weights = []
    if len(estimates) >= 1 and agency_avg:
        weights.append(3.0)  # Agency avg gets 3x weight
    if len(estimates) >= 2 and (incident_type and type_avg):
        weights.append(2.0)  # Type avg gets 2x weight
    if len(estimates) >= 3:
        weights.append(1.5)  # Hourly estimate gets 1.5x weight
    if len(estimates) >= 4:
        weights.append(1.0)  # Default gets 1x weight

    # Pad weights if needed
    while len(weights) < len(estimates):
        weights.append(1.0)

    weighted_sum = sum(e * w for e, w in zip(estimates, weights))
    total_weight = sum(weights)
    predicted_cost = weighted_sum / total_weight

    # Calculate confidence based on data availability
    if agency_avg and len(estimates) >= 2:
        confidence = "high"
    elif agency_avg or (incident_type and type_avg):
        confidence = "medium"
    else:
        confidence = "low"

    # Calculate range (±30% for high confidence, ±50% for medium, ±75% for low)
    range_percent = {"high": 0.3, "medium": 0.5, "low": 0.75}[confidence]
    range_low = max(0.0, predicted_cost * (1 - range_percent))
    range_high = predicted_cost * (1 + range_percent)

    return {
        "estimated_cost": round(predicted_cost, 2),
        "confidence": confidence,
        "method": ", ".join(methods),
        "range_low": round(range_low, 2),
        "range_high": round(range_high, 2),
        "data_points": len([m for m in methods if "avg" in m]),
        "agency_name": agency.name,
        "notes": _generate_cost_notes(
            agency, incident_type, predicted_cost, confidence
        ),
    }


def _generate_cost_notes(
    agency: Agency,
    incident_type: Optional[IncidentType],
    predicted_cost: float,
    confidence: str,
) -> str:
    """Generate helpful notes about the cost prediction."""
    notes = []

    # Agency-specific notes
    if agency.typical_cost_per_hour and agency.typical_cost_per_hour > 0:
        notes.append(
            f"{agency.name} typically charges ${agency.typical_cost_per_hour}/hour"
        )
    else:
        notes.append(f"{agency.name} has not charged for footage in past requests")

    # Incident-specific notes
    if incident_type == IncidentType.ois:
        notes.append("OIS incidents typically have longer footage (30+ min)")
    elif incident_type == IncidentType.arrest:
        notes.append("Standard arrests usually have shorter footage (5-15 min)")

    # Cost level notes
    if predicted_cost == 0:
        notes.append("This agency may provide footage free of charge")
    elif predicted_cost < 10:
        notes.append("Low cost - good candidate for auto-submission")
    elif predicted_cost > 50:
        notes.append("Higher cost - consider ROI before submission")

    # Confidence notes
    if confidence == "low":
        notes.append("Limited historical data - estimate is rough")

    return " | ".join(notes)


async def calculate_roi_projection(
    db: AsyncSession,
    predicted_cost: float,
    incident_type: Optional[IncidentType] = None,
    virality_score: Optional[int] = None,
) -> dict:
    """Project potential ROI for a FOIA request.

    Uses historical performance data to estimate potential revenue.

    Args:
        db: Database session
        predicted_cost: Estimated FOIA cost
        incident_type: Type of incident
        virality_score: Predicted virality (1-10)

    Returns:
        Dict with ROI projection
    """
    # Get average revenue by incident type
    from app.models.news_article import NewsArticle
    from app.models.video import Video
    from app.models.video_analytics import VideoAnalytics

    if incident_type:
        result = await db.execute(
            select(func.avg(VideoAnalytics.estimated_revenue))
            .join(Video, VideoAnalytics.video_id == Video.id)
            .join(FoiaRequest, Video.foia_request_id == FoiaRequest.id)
            .join(NewsArticle, FoiaRequest.news_article_id == NewsArticle.id)
            .where(NewsArticle.incident_type == incident_type)
        )
        avg_revenue = result.scalar()
        estimated_revenue = float(avg_revenue) if avg_revenue else 50.0
    else:
        estimated_revenue = 50.0  # Default

    # Adjust based on virality score
    if virality_score:
        # High virality (8-10) = 2x revenue
        # Medium virality (5-7) = 1x revenue
        # Low virality (1-4) = 0.5x revenue
        if virality_score >= 8:
            estimated_revenue *= 2.0
        elif virality_score <= 4:
            estimated_revenue *= 0.5

    # Calculate ROI
    net_profit = estimated_revenue - predicted_cost
    roi_percent = (net_profit / max(predicted_cost, 1.0)) * 100 if predicted_cost > 0 else float('inf')

    # Determine recommendation
    if predicted_cost == 0:
        recommendation = "STRONG YES - Free footage"
    elif roi_percent > 200:
        recommendation = "STRONG YES - High ROI expected"
    elif roi_percent > 100:
        recommendation = "YES - Good ROI expected"
    elif roi_percent > 0:
        recommendation = "MAYBE - Modest ROI expected"
    else:
        recommendation = "CAUTION - May not be profitable"

    return {
        "estimated_revenue": round(estimated_revenue, 2),
        "estimated_cost": round(predicted_cost, 2),
        "net_profit": round(net_profit, 2),
        "roi_percent": round(roi_percent, 1),
        "recommendation": recommendation,
        "break_even_views": max(1, int((predicted_cost / 0.005))),  # Assuming $5 RPM
    }
