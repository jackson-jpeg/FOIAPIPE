"""Celery tasks for YouTube analytics polling."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _poll_analytics_async():
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.video import Video, VideoStatus
    from app.models.video_analytics import VideoAnalytics
    from app.services.youtube_client import get_video_stats
    from app.config import settings

    # Check if YouTube API is configured
    if not settings.YOUTUBE_CLIENT_ID or not settings.YOUTUBE_REFRESH_TOKEN:
        logger.warning("YouTube API not configured, skipping analytics sync")
        return {"skipped": True, "reason": "YouTube API not configured"}

    async with async_session_factory() as db:
        stmt = select(Video).where(
            Video.status == VideoStatus.published,
            Video.youtube_video_id.isnot(None),
        )
        videos = (await db.execute(stmt)).scalars().all()

        updated = 0
        today = datetime.now(timezone.utc).date()

        for video in videos:
            try:
                # Call YouTube Data API to get current stats
                stats = get_video_stats(video.youtube_video_id)

                if stats.get("error"):
                    logger.error(f"Failed to get stats for {video.youtube_video_id}: {stats['error']}")
                    continue

                # Check if we already have analytics for today
                existing = await db.execute(
                    select(VideoAnalytics).where(
                        VideoAnalytics.video_id == video.id,
                        VideoAnalytics.date == today,
                    )
                )
                existing_analytics = existing.scalar_one_or_none()

                if existing_analytics:
                    # Update existing record
                    existing_analytics.views = stats.get("views", 0)
                    existing_analytics.likes = stats.get("likes", 0)
                    existing_analytics.comments = stats.get("comments", 0)
                    logger.info(f"Updated analytics for video {video.id}: {stats.get('views')} views")
                else:
                    # Create new analytics snapshot
                    analytics = VideoAnalytics(
                        video_id=video.id,
                        date=today,
                        views=stats.get("views", 0),
                        likes=stats.get("likes", 0),
                        comments=stats.get("comments", 0),
                    )
                    db.add(analytics)
                    logger.info(f"Created analytics for video {video.id}: {stats.get('views')} views")

                updated += 1

            except Exception as e:
                logger.error(f"Analytics error for video {video.id}: {e}")

        await db.commit()
        return {"videos_checked": len(videos), "updated": updated}


@celery_app.task(name="app.tasks.youtube_tasks.poll_youtube_analytics")
def poll_youtube_analytics():
    """Pull analytics for all published YouTube videos."""
    logger.info("Polling YouTube analytics")
    try:
        result = _run_async(_poll_analytics_async())
        logger.info(f"Analytics poll: {result}")
        return result
    except Exception as e:
        logger.error(f"Analytics poll failed: {e}")
        return {"error": str(e)}


@celery_app.task(name="app.tasks.youtube_tasks.upload_video")
def upload_video(video_id: str):
    """Upload a video to YouTube."""
    logger.info(f"Uploading video {video_id}")
    # Will be implemented in Phase 6
    return {"status": "not_implemented"}
