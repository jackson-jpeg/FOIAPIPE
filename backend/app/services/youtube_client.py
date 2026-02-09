"""YouTube Data API v3 and Analytics API wrapper."""
import logging
from typing import Optional
from datetime import date

from app.config import settings

logger = logging.getLogger(__name__)


def _get_youtube_service():
    """Build authenticated YouTube Data API v3 service."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    if not settings.YOUTUBE_CLIENT_ID or not settings.YOUTUBE_REFRESH_TOKEN:
        raise RuntimeError("YouTube API not configured")

    creds = Credentials(
        token=None,
        refresh_token=settings.YOUTUBE_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.YOUTUBE_CLIENT_ID,
        client_secret=settings.YOUTUBE_CLIENT_SECRET,
    )
    return build("youtube", "v3", credentials=creds)


def _get_analytics_service():
    """Build authenticated YouTube Analytics API service."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=settings.YOUTUBE_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.YOUTUBE_CLIENT_ID,
        client_secret=settings.YOUTUBE_CLIENT_SECRET,
    )
    return build("youtubeAnalytics", "v2", credentials=creds)


def upload_video(
    file_path: str,
    title: str,
    description: str,
    tags: list[str],
    category_id: str = "25",
    privacy: str = "unlisted",
) -> dict:
    """Upload a video to YouTube via resumable upload."""
    from googleapiclient.http import MediaFileUpload

    youtube = _get_youtube_service()
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category_id,
        },
        "status": {"privacyStatus": privacy},
    }
    media = MediaFileUpload(file_path, mimetype="video/*", resumable=True, chunksize=10 * 1024 * 1024)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            logger.info(f"Upload progress: {int(status.progress() * 100)}%")

    video_id = response["id"]
    logger.info(f"Upload complete: {video_id}")
    return {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "status": response.get("status", {}).get("uploadStatus", "unknown"),
    }


def update_video_metadata(video_id: str, title: str, description: str, tags: list[str]) -> dict:
    """Update metadata of an existing YouTube video."""
    youtube = _get_youtube_service()
    body = {
        "id": video_id,
        "snippet": {"title": title, "description": description, "tags": tags, "categoryId": "25"},
    }
    response = youtube.videos().update(part="snippet", body=body).execute()
    return {"updated": True, "video_id": response["id"]}


def set_thumbnail(video_id: str, thumbnail_path: str) -> dict:
    """Set a custom thumbnail for a YouTube video."""
    from googleapiclient.http import MediaFileUpload
    youtube = _get_youtube_service()
    media = MediaFileUpload(thumbnail_path, mimetype="image/jpeg")
    response = youtube.thumbnails().set(videoId=video_id, media_body=media).execute()
    return {"set": True, "items": response.get("items", [])}


def get_video_status(video_id: str) -> dict:
    """Check processing status of a YouTube video."""
    youtube = _get_youtube_service()
    response = youtube.videos().list(part="status,processingDetails", id=video_id).execute()
    items = response.get("items", [])
    if not items:
        return {"error": "Video not found"}
    item = items[0]
    return {
        "upload_status": item.get("status", {}).get("uploadStatus"),
        "privacy_status": item.get("status", {}).get("privacyStatus"),
        "processing": item.get("processingDetails", {}),
    }


def get_video_stats(video_id: str) -> dict:
    """Get current statistics for a YouTube video (views, likes, comments, etc)."""
    youtube = _get_youtube_service()
    response = youtube.videos().list(
        part="statistics,snippet",
        id=video_id
    ).execute()

    items = response.get("items", [])
    if not items:
        return {"error": "Video not found"}

    item = items[0]
    stats = item.get("statistics", {})
    snippet = item.get("snippet", {})

    return {
        "video_id": video_id,
        "views": int(stats.get("viewCount", 0)),
        "likes": int(stats.get("likeCount", 0)),
        "comments": int(stats.get("commentCount", 0)),
        "published_at": snippet.get("publishedAt"),
    }


def get_analytics(video_id: str, start_date: date, end_date: date) -> dict:
    """Pull analytics for a specific video from YouTube Analytics API."""
    analytics = _get_analytics_service()
    response = analytics.reports().query(
        ids="channel==MINE",
        startDate=start_date.isoformat(),
        endDate=end_date.isoformat(),
        metrics="views,estimatedMinutesWatched,estimatedRevenue,impressions,impressionClickThroughRate,subscribersGained,subscribersLost,likes,dislikes,comments,shares",
        filters=f"video=={video_id}",
        dimensions="day",
    ).execute()

    rows = response.get("rows", [])
    return {
        "video_id": video_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily_data": [
            {
                "date": row[0],
                "views": row[1],
                "watch_time_minutes": row[2],
                "estimated_revenue": row[3],
                "impressions": row[4],
                "ctr": row[5],
                "subscribers_gained": row[6],
                "subscribers_lost": row[7],
                "likes": row[8],
                "dislikes": row[9],
                "comments": row[10],
                "shares": row[11],
            }
            for row in rows
        ],
    }
