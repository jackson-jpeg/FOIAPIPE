"""Data export router – CSV/Excel downloads."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.foia_request import FoiaRequest, FoiaStatus
from app.models.news_article import NewsArticle, Severity
from app.models.video import Video, VideoStatus
from app.services.data_export import (
    export_analytics_summary_to_csv,
    export_articles_to_csv,
    export_foias_to_csv,
    export_videos_to_csv,
)

router = APIRouter(prefix="/api/exports", tags=["exports"])


@router.get("/foias")
async def export_foias(
    status_filter: FoiaStatus | None = Query(None, alias="status", description="Filter by status"),
    date_from: datetime | None = Query(None, description="Created after this date"),
    date_to: datetime | None = Query(None, description="Created before this date"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> Response:
    """Export FOIA requests to CSV format.

    Returns CSV file with FOIA request data.
    """
    # Build query
    stmt = select(FoiaRequest).order_by(FoiaRequest.created_at.desc())

    # Apply filters
    filters = []
    if status_filter:
        filters.append(FoiaRequest.status == status_filter)
    if date_from:
        filters.append(FoiaRequest.created_at >= date_from)
    if date_to:
        filters.append(FoiaRequest.created_at <= date_to)

    if filters:
        stmt = stmt.where(and_(*filters))

    # Execute query
    result = await db.execute(stmt)
    foias = result.scalars().all()

    # Generate CSV
    csv_data = await export_foias_to_csv(db, foias)

    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"foias_export_{timestamp}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/articles")
async def export_articles(
    severity: Severity | None = Query(None, description="Filter by severity"),
    date_from: datetime | None = Query(None, description="Published after this date"),
    date_to: datetime | None = Query(None, description="Published before this date"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> Response:
    """Export news articles to CSV format.

    Returns CSV file with article data.
    """
    # Build query
    stmt = select(NewsArticle).order_by(NewsArticle.published_at.desc())

    # Apply filters
    filters = []
    if severity:
        filters.append(NewsArticle.severity == severity)
    if date_from:
        filters.append(NewsArticle.published_at >= date_from)
    if date_to:
        filters.append(NewsArticle.published_at <= date_to)

    if filters:
        stmt = stmt.where(and_(*filters))

    # Execute query
    result = await db.execute(stmt)
    articles = result.scalars().all()

    # Generate CSV
    csv_data = await export_articles_to_csv(db, articles)

    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"articles_export_{timestamp}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/videos")
async def export_videos(
    status_filter: VideoStatus | None = Query(None, alias="status", description="Filter by status"),
    date_from: datetime | None = Query(None, description="Published after this date"),
    date_to: datetime | None = Query(None, description="Published before this date"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> Response:
    """Export videos to CSV format.

    Returns CSV file with video data including analytics.
    """
    # Build query
    stmt = select(Video).order_by(Video.created_at.desc())

    # Apply filters
    filters = []
    if status_filter:
        filters.append(Video.status == status_filter)
    if date_from:
        filters.append(Video.published_at >= date_from)
    if date_to:
        filters.append(Video.published_at <= date_to)

    if filters:
        stmt = stmt.where(and_(*filters))

    # Execute query
    result = await db.execute(stmt)
    videos = result.scalars().all()

    # Generate CSV
    csv_data = await export_videos_to_csv(db, videos)

    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"videos_export_{timestamp}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/analytics-summary")
async def export_analytics_summary(
    days: int = Query(30, ge=1, le=365, description="Number of days to export"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> Response:
    """Export daily analytics summary to CSV format.

    Returns CSV file with daily aggregated statistics.
    """
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)

    # Generate CSV
    csv_data = await export_analytics_summary_to_csv(db, start_date, end_date)

    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"analytics_summary_{timestamp}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/full-backup")
async def export_full_backup(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Export all data as JSON for backup purposes.

    Returns metadata about available exports and instructions.
    """
    # Count records
    foias_count = (await db.execute(select(func.count(FoiaRequest.id)))).scalar() or 0
    articles_count = (await db.execute(select(func.count(NewsArticle.id)))).scalar() or 0
    videos_count = (await db.execute(select(func.count(Video.id)))).scalar() or 0

    return {
        "message": "Full backup export",
        "instructions": "Use individual endpoints to export specific data types",
        "available_exports": {
            "foias": {
                "endpoint": "/api/exports/foias",
                "count": foias_count,
                "format": "CSV",
            },
            "articles": {
                "endpoint": "/api/exports/articles",
                "count": articles_count,
                "format": "CSV",
            },
            "videos": {
                "endpoint": "/api/exports/videos",
                "count": videos_count,
                "format": "CSV",
            },
            "analytics": {
                "endpoint": "/api/exports/analytics-summary",
                "format": "CSV",
            },
        },
        "database_backup": {
            "script": "scripts/backup_database.py",
            "description": "For full database backup, use the backup script",
        },
    }
