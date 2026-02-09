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

    async with async_session_factory() as db:
        stmt = select(Video).where(
            Video.status == VideoStatus.published,
            Video.youtube_video_id.isnot(None),
        )
        videos = (await db.execute(stmt)).scalars().all()

        updated = 0
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()

        for video in videos:
            try:
                # YouTube API call would go here
                # For now, create a placeholder analytics entry
                existing = await db.execute(
                    select(VideoAnalytics).where(
                        VideoAnalytics.video_id == video.id,
                        VideoAnalytics.date == yesterday,
                    )
                )
                if not existing.scalar_one_or_none():
                    analytics = VideoAnalytics(
                        video_id=video.id,
                        date=yesterday,
                    )
                    db.add(analytics)
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
