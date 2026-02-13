"""Article prioritization based on revenue feedback loop.

Analyzes the full pipeline (article -> FOIA -> video -> revenue) to identify
patterns that correlate with high views/revenue, and assigns predicted_revenue
to new articles.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Base revenue multipliers by incident type (from historical data patterns)
_INCIDENT_TYPE_MULTIPLIERS = {
    "ois": 3.0,           # Officer-involved shootings get highest views
    "use_of_force": 2.5,
    "pursuit": 2.0,
    "taser": 1.8,
    "k9": 1.5,
    "arrest": 1.0,
    "dui": 0.8,
    "other": 0.6,
}

# Keyword boost factors (headline keywords that correlate with high engagement)
_KEYWORD_BOOSTS = {
    "bodycam": 1.5,
    "body cam": 1.5,
    "dashcam": 1.3,
    "dash cam": 1.3,
    "shooting": 1.8,
    "fatal": 1.7,
    "killed": 1.6,
    "death": 1.5,
    "tased": 1.4,
    "taser": 1.4,
    "pursuit": 1.3,
    "chase": 1.3,
    "excessive force": 2.0,
    "brutality": 2.0,
    "misconduct": 1.6,
    "fired": 1.4,
    "suspended": 1.3,
    "investigation": 1.1,
}


async def compute_revenue_baselines(db: AsyncSession) -> dict:
    """Compute per-incident-type average revenue from historical data.

    Returns a dict mapping incident_type -> avg_revenue based on the full
    article -> foia -> video -> revenue pipeline.
    """
    from app.models.foia_request import FoiaRequest
    from app.models.news_article import IncidentType, NewsArticle
    from app.models.video import Video
    from app.models.video_analytics import VideoAnalytics

    # Join the full pipeline: article -> foia -> video -> analytics
    stmt = (
        select(
            NewsArticle.incident_type,
            func.count(func.distinct(Video.id)).label("video_count"),
            func.sum(VideoAnalytics.estimated_revenue).label("total_revenue"),
            func.sum(VideoAnalytics.views).label("total_views"),
        )
        .join(FoiaRequest, FoiaRequest.news_article_id == NewsArticle.id)
        .join(Video, Video.foia_request_id == FoiaRequest.id)
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id)
        .where(NewsArticle.incident_type.isnot(None))
        .group_by(NewsArticle.incident_type)
    )

    result = await db.execute(stmt)
    rows = result.all()

    baselines = {}
    for row in rows:
        if row.video_count and row.video_count > 0:
            avg_rev = float(row.total_revenue or 0) / row.video_count
            avg_views = float(row.total_views or 0) / row.video_count
            baselines[row.incident_type.value if row.incident_type else "other"] = {
                "avg_revenue": round(avg_rev, 2),
                "avg_views": round(avg_views),
                "video_count": row.video_count,
            }

    return baselines


async def prioritize_article(
    db: AsyncSession,
    article_id: str,
) -> dict:
    """Compute predicted revenue and priority factors for an article.

    Uses a combination of:
    1. Historical revenue baselines per incident type
    2. Keyword-based engagement prediction
    3. Severity and virality scores
    4. Agency-specific performance data
    """
    from app.models.news_article import NewsArticle

    article = await db.get(NewsArticle, article_id)
    if not article:
        return {"error": "Article not found"}

    factors = {}
    score = 1.0  # Base multiplier

    # 1. Incident type multiplier
    incident_type = article.incident_type.value if article.incident_type else "other"
    type_mult = _INCIDENT_TYPE_MULTIPLIERS.get(incident_type, 0.6)
    score *= type_mult
    factors["incident_type"] = {"type": incident_type, "multiplier": type_mult}

    # 2. Keyword analysis
    headline_lower = (article.headline or "").lower()
    summary_lower = (article.summary or "").lower()
    text = headline_lower + " " + summary_lower
    keyword_boost = 1.0
    matched_keywords = []
    for keyword, boost in _KEYWORD_BOOSTS.items():
        if keyword in text:
            keyword_boost = max(keyword_boost, boost)
            matched_keywords.append(keyword)
    score *= keyword_boost
    factors["keywords"] = {"matched": matched_keywords, "boost": keyword_boost}

    # 3. Severity score impact
    severity = article.severity_score or 5
    severity_mult = 0.5 + (severity / 10.0) * 1.5  # Range: 0.5 - 2.0
    score *= severity_mult
    factors["severity"] = {"score": severity, "multiplier": round(severity_mult, 2)}

    # 4. Virality score impact
    virality = article.virality_score or 5
    virality_mult = 0.7 + (virality / 10.0) * 0.6  # Range: 0.7 - 1.3
    score *= virality_mult
    factors["virality"] = {"score": virality, "multiplier": round(virality_mult, 2)}

    # 5. Historical revenue baselines (if available)
    baselines = await compute_revenue_baselines(db)
    baseline_rev = None
    if incident_type in baselines:
        baseline_rev = baselines[incident_type]["avg_revenue"]
        factors["historical"] = baselines[incident_type]

    # Compute predicted revenue
    # Use baseline if available, otherwise use a default base ($5)
    base_revenue = baseline_rev if baseline_rev else 5.0
    predicted = round(base_revenue * score, 2)

    # Update article
    article.predicted_revenue = Decimal(str(predicted))
    article.priority_factors = factors
    await db.flush()

    return {
        "article_id": str(article.id),
        "predicted_revenue": predicted,
        "priority_factors": factors,
        "score_multiplier": round(score, 2),
    }
