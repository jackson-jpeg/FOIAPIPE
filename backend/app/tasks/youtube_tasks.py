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


async def _upload_video_async(video_id: str) -> dict:
    """Download video from S3, upload to YouTube, update DB record."""
    import tempfile
    import os
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.video import Video, VideoStatus
    from app.models.video_status_change import VideoStatusChange
    from app.services.storage import download_file
    from app.services.youtube_client import upload_video as yt_upload
    from app.config import settings

    if not settings.YOUTUBE_CLIENT_ID or not settings.YOUTUBE_REFRESH_TOKEN:
        return {"error": "YouTube API not configured"}

    async with async_session_factory() as db:
        video = await db.get(Video, video_id)
        if not video:
            return {"error": f"Video {video_id} not found"}

        # Prefer processed file, fall back to raw
        storage_key = video.processed_storage_key or video.raw_storage_key
        if not storage_key:
            return {"error": "No video file in storage"}

        # Record status transition to uploading
        old_status = video.status.value
        video.status = VideoStatus.uploading
        video.youtube_upload_status = "uploading"
        db.add(VideoStatusChange(
            video_id=video.id,
            from_status=old_status,
            to_status=VideoStatus.uploading.value,
            changed_by="youtube_upload_task",
            reason="Upload to YouTube started",
        ))
        await db.commit()

        # Download from S3 to temp file
        tmp_path = None
        try:
            logger.info(f"Downloading {storage_key} from S3")
            file_bytes = download_file(storage_key)

            suffix = os.path.splitext(storage_key)[1] or ".mp4"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            # Build metadata
            title = video.title or "Bodycam Footage"
            description = video.description or ""
            tags = video.tags or ["bodycam", "police", "FOIA", "Tampa Bay"]

            logger.info(f"Uploading {video_id} to YouTube: {title}")
            result = yt_upload(
                file_path=tmp_path,
                title=title,
                description=description,
                tags=tags,
                category_id="25",
                privacy=video.visibility or "unlisted",
            )

            # Update video record
            video.youtube_video_id = result["video_id"]
            video.youtube_url = result["url"]
            video.youtube_upload_status = result.get("status", "uploaded")
            video.status = VideoStatus.published
            video.published_at = datetime.now(timezone.utc)

            db.add(VideoStatusChange(
                video_id=video.id,
                from_status=VideoStatus.uploading.value,
                to_status=VideoStatus.published.value,
                changed_by="youtube_upload_task",
                reason=f"Uploaded to YouTube: {result['url']}",
                extra_metadata={"youtube_video_id": result["video_id"]},
            ))
            await db.commit()

            logger.info(f"Video {video_id} published: {result['url']}")
            return {
                "success": True,
                "video_id": video_id,
                "youtube_video_id": result["video_id"],
                "youtube_url": result["url"],
            }

        except Exception as e:
            logger.error(f"YouTube upload failed for {video_id}: {e}")
            video.youtube_upload_status = f"failed: {str(e)[:200]}"
            video.status = VideoStatus.ready
            db.add(VideoStatusChange(
                video_id=video.id,
                from_status=VideoStatus.uploading.value,
                to_status=VideoStatus.ready.value,
                changed_by="youtube_upload_task",
                reason=f"Upload failed: {str(e)[:200]}",
            ))
            await db.commit()
            return {"error": str(e)}

        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)


@celery_app.task(
    name="app.tasks.youtube_tasks.upload_video",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def upload_video(self, video_id: str):
    """Upload a video to YouTube. Downloads from S3, uploads via API, updates DB."""
    logger.info(f"Uploading video {video_id} to YouTube")
    try:
        result = _run_async(_upload_video_async(video_id))
        if result.get("error") and self.request.retries < self.max_retries:
            raise self.retry(exc=Exception(result["error"]))
        logger.info(f"Upload result for {video_id}: {result}")
        return result
    except Exception as e:
        logger.error(f"Upload task failed for {video_id}: {e}")
        raise
