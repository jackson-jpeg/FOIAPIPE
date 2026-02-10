"""Smart YouTube publishing scheduler based on historical performance data."""

from __future__ import annotations

import logging
from datetime import datetime, time, timedelta
from typing import Optional

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video, VideoStatus
from app.models.video_analytics import VideoAnalytics

logger = logging.getLogger(__name__)


# Optimal publishing times based on YouTube best practices
# These are Eastern Time hours when engagement is typically highest
OPTIMAL_HOURS = {
    "weekday": [14, 15, 16, 17, 18, 19, 20],  # 2 PM - 8 PM ET
    "weekend": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],  # 10 AM - 7 PM ET
}


async def analyze_best_publish_times(db: AsyncSession, days_back: int = 90) -> dict:
    """Analyze historical data to find optimal publish times.

    Returns:
        Dict with recommended hours by day of week
    """
    cutoff = datetime.now() - timedelta(days=days_back)

    # Get all published videos with their analytics
    result = await db.execute(
        select(
            Video.published_at,
            func.sum(VideoAnalytics.views).label("total_views"),
            func.avg(VideoAnalytics.ctr).label("avg_ctr"),
            func.sum(VideoAnalytics.estimated_revenue).label("total_revenue"),
        )
        .join(VideoAnalytics, VideoAnalytics.video_id == Video.id)
        .where(
            and_(
                Video.published_at >= cutoff,
                Video.status == VideoStatus.published,
                VideoAnalytics.date <= VideoAnalytics.date + timedelta(days=7),  # First week performance
            )
        )
        .group_by(Video.id, Video.published_at)
    )

    videos = result.all()

    if not videos or len(videos) < 10:
        logger.info("Insufficient historical data, using default optimal times")
        return {
            "has_data": False,
            "recommendations": OPTIMAL_HOURS,
            "data_points": len(videos) if videos else 0,
        }

    # Group by hour and day of week
    hour_performance = {}
    for video in videos:
        if not video.published_at:
            continue

        hour = video.published_at.hour
        day_of_week = video.published_at.weekday()  # 0=Monday, 6=Sunday
        is_weekend = day_of_week >= 5

        key = f"{'weekend' if is_weekend else 'weekday'}_{hour}"

        if key not in hour_performance:
            hour_performance[key] = {
                "count": 0,
                "total_views": 0,
                "total_ctr": 0,
                "total_revenue": 0,
            }

        hour_performance[key]["count"] += 1
        hour_performance[key]["total_views"] += int(video.total_views or 0)
        hour_performance[key]["total_ctr"] += float(video.avg_ctr or 0)
        hour_performance[key]["total_revenue"] += float(video.total_revenue or 0)

    # Calculate averages and rank hours
    weekday_hours = []
    weekend_hours = []

    for key, stats in hour_performance.items():
        if stats["count"] < 2:  # Need at least 2 data points
            continue

        day_type, hour_str = key.split("_")
        hour = int(hour_str)

        avg_views = stats["total_views"] / stats["count"]
        avg_ctr = stats["total_ctr"] / stats["count"]
        avg_revenue = stats["total_revenue"] / stats["count"]

        # Score based on views (60%), CTR (20%), revenue (20%)
        score = (avg_views * 0.6) + (avg_ctr * 1000 * 0.2) + (avg_revenue * 10 * 0.2)

        hour_data = {
            "hour": hour,
            "score": score,
            "avg_views": avg_views,
            "avg_ctr": avg_ctr,
            "avg_revenue": avg_revenue,
            "data_points": stats["count"],
        }

        if day_type == "weekday":
            weekday_hours.append(hour_data)
        else:
            weekend_hours.append(hour_data)

    # Sort by score and take top hours
    weekday_hours.sort(key=lambda x: x["score"], reverse=True)
    weekend_hours.sort(key=lambda x: x["score"], reverse=True)

    recommendations = {
        "weekday": [h["hour"] for h in weekday_hours[:7]] or OPTIMAL_HOURS["weekday"],
        "weekend": [h["hour"] for h in weekend_hours[:7]] or OPTIMAL_HOURS["weekend"],
    }

    return {
        "has_data": True,
        "recommendations": recommendations,
        "data_points": len(videos),
        "top_weekday_hours": weekday_hours[:5],
        "top_weekend_hours": weekend_hours[:5],
    }


async def get_next_optimal_publish_time(
    db: AsyncSession,
    earliest: Optional[datetime] = None,
) -> datetime:
    """Calculate the next optimal time to publish a video.

    Args:
        db: Database session
        earliest: Earliest allowed publish time (default: now + 1 hour)

    Returns:
        Optimal datetime to publish
    """
    if earliest is None:
        earliest = datetime.now() + timedelta(hours=1)

    # Get optimal hours based on historical data
    analysis = await analyze_best_publish_times(db)
    optimal_hours = analysis["recommendations"]

    # Start searching from earliest time
    current = earliest
    max_search_days = 7  # Don't search more than a week ahead

    for _ in range(max_search_days):
        is_weekend = current.weekday() >= 5
        day_type = "weekend" if is_weekend else "weekday"
        available_hours = optimal_hours[day_type]

        # Check if current hour is optimal
        if current.hour in available_hours:
            # Round to next 30-minute mark for cleaner scheduling
            if current.minute < 30:
                return current.replace(minute=0, second=0, microsecond=0)
            else:
                return current.replace(minute=30, second=0, microsecond=0)

        # Find next optimal hour today
        future_hours = [h for h in available_hours if h > current.hour]
        if future_hours:
            next_hour = min(future_hours)
            return current.replace(
                hour=next_hour, minute=0, second=0, microsecond=0
            )

        # No more optimal hours today, try tomorrow's first optimal hour
        current = (current + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    # Fallback: just return earliest + 2 hours
    logger.warning("Could not find optimal time in 7 days, using fallback")
    return earliest + timedelta(hours=2)


async def schedule_video_queue(
    db: AsyncSession,
    video_ids: list,
    start_time: Optional[datetime] = None,
    spacing_hours: int = 24,
) -> dict:
    """Schedule multiple videos at optimal times with spacing.

    Args:
        db: Database session
        video_ids: List of video IDs to schedule
        start_time: When to start scheduling (default: now + 1 hour)
        spacing_hours: Minimum hours between publishes (default: 24)

    Returns:
        Dict mapping video_id -> scheduled_datetime
    """
    if start_time is None:
        start_time = datetime.now() + timedelta(hours=1)

    schedule = {}
    current_earliest = start_time

    for video_id in video_ids:
        optimal_time = await get_next_optimal_publish_time(db, current_earliest)
        schedule[str(video_id)] = optimal_time

        # Next video must be at least spacing_hours later
        current_earliest = optimal_time + timedelta(hours=spacing_hours)

    return schedule


def is_optimal_time(dt: datetime, day_type: str = "weekday") -> bool:
    """Check if a given datetime is during optimal publishing hours.

    Args:
        dt: Datetime to check
        day_type: "weekday" or "weekend"

    Returns:
        True if time is optimal for publishing
    """
    hour = dt.hour
    return hour in OPTIMAL_HOURS.get(day_type, OPTIMAL_HOURS["weekday"])


async def get_publish_recommendations(db: AsyncSession) -> dict:
    """Get publishing recommendations for videos ready to publish.

    Returns:
        Recommendations including:
        - Next optimal publish time
        - Videos ready to publish
        - Suggested schedule
    """
    # Get videos ready for publishing
    result = await db.execute(
        select(Video)
        .where(Video.status == VideoStatus.ready_for_upload)
        .order_by(Video.created_at.desc())
        .limit(10)
    )
    ready_videos = list(result.scalars().all())

    if not ready_videos:
        return {
            "ready_count": 0,
            "next_optimal_time": None,
            "recommendations": "No videos ready to publish",
        }

    # Get next optimal time
    next_optimal = await get_next_optimal_publish_time(db)

    # Create suggested schedule
    video_ids = [v.id for v in ready_videos]
    schedule = await schedule_video_queue(db, video_ids)

    return {
        "ready_count": len(ready_videos),
        "next_optimal_time": next_optimal.isoformat(),
        "ready_videos": [
            {
                "id": str(v.id),
                "title": v.title,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "suggested_publish_time": schedule[str(v.id)].isoformat(),
            }
            for v in ready_videos
        ],
    }
