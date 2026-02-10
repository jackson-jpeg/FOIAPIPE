"""Data export service for generating CSV/Excel reports."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.foia_request import FoiaRequest
from app.models.news_article import NewsArticle
from app.models.video import Video


async def export_foias_to_csv(
    db: AsyncSession,
    foias: Sequence[FoiaRequest],
) -> bytes:
    """Export FOIA requests to CSV format.

    Args:
        db: Database session
        foias: Sequence of FOIA requests to export

    Returns:
        CSV data as bytes
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "Case Number",
        "Agency",
        "Status",
        "Priority",
        "Article Headline",
        "Submitted At",
        "Due Date",
        "Fulfilled At",
        "Estimated Cost",
        "Actual Cost",
        "Payment Status",
        "Auto Submitted",
        "Created At",
    ])

    # Write data rows
    for foia in foias:
        agency_name = foia.agency.name if foia.agency else ""
        article_headline = foia.news_article.headline if foia.news_article else ""

        writer.writerow([
            foia.case_number,
            agency_name,
            foia.status.value,
            foia.priority.value,
            article_headline,
            foia.submitted_at.isoformat() if foia.submitted_at else "",
            foia.due_date.isoformat() if foia.due_date else "",
            foia.fulfilled_at.isoformat() if foia.fulfilled_at else "",
            float(foia.estimated_cost) if foia.estimated_cost else "",
            float(foia.actual_cost) if foia.actual_cost else "",
            foia.payment_status or "",
            "Yes" if foia.is_auto_submitted else "No",
            foia.created_at.isoformat() if foia.created_at else "",
        ])

    return output.getvalue().encode("utf-8")


async def export_articles_to_csv(
    db: AsyncSession,
    articles: Sequence[NewsArticle],
) -> bytes:
    """Export news articles to CSV format.

    Args:
        db: Database session
        articles: Sequence of news articles to export

    Returns:
        CSV data as bytes
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "ID",
        "Headline",
        "Source",
        "Published At",
        "Incident Type",
        "Severity",
        "Location",
        "Officers",
        "Virality Score",
        "URL",
        "Created At",
    ])

    # Write data rows
    for article in articles:
        writer.writerow([
            str(article.id),
            article.headline,
            article.source_name,
            article.published_at.isoformat() if article.published_at else "",
            article.incident_type.value if article.incident_type else "",
            article.severity.value if article.severity else "",
            article.detected_location or "",
            ", ".join(article.detected_officers) if article.detected_officers else "",
            article.virality_score or "",
            article.url,
            article.created_at.isoformat() if article.created_at else "",
        ])

    return output.getvalue().encode("utf-8")


async def export_videos_to_csv(
    db: AsyncSession,
    videos: Sequence[Video],
) -> bytes:
    """Export videos to CSV format.

    Args:
        db: Database session
        videos: Sequence of videos to export

    Returns:
        CSV data as bytes
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "ID",
        "Title",
        "Status",
        "FOIA Case Number",
        "YouTube URL",
        "Duration (sec)",
        "Published At",
        "Total Views",
        "Total Revenue",
        "Created At",
    ])

    # Write data rows
    for video in videos:
        foia_case = video.foia_request.case_number if video.foia_request else ""

        # Get total views and revenue from analytics
        total_views = 0
        total_revenue = 0.0

        if hasattr(video, "analytics") and video.analytics:
            total_views = sum(a.views for a in video.analytics)
            total_revenue = sum(float(a.estimated_revenue or 0) for a in video.analytics)

        writer.writerow([
            str(video.id),
            video.title,
            video.status.value,
            foia_case,
            video.youtube_url or "",
            video.duration_seconds or "",
            video.published_at.isoformat() if video.published_at else "",
            total_views,
            f"{total_revenue:.2f}",
            video.created_at.isoformat() if video.created_at else "",
        ])

    return output.getvalue().encode("utf-8")


async def export_analytics_summary_to_csv(
    db: AsyncSession,
    start_date: datetime,
    end_date: datetime,
) -> bytes:
    """Export analytics summary to CSV format.

    Args:
        db: Database session
        start_date: Start of date range
        end_date: End of date range

    Returns:
        CSV data as bytes
    """
    from sqlalchemy import and_, func
    from app.models.video_analytics import VideoAnalytics

    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "Date",
        "Total Views",
        "Total Revenue",
        "Videos Published",
        "FOIAs Submitted",
        "Articles Scanned",
    ])

    # Query daily aggregates
    # Videos analytics by date
    video_stats = await db.execute(
        select(
            VideoAnalytics.date,
            func.sum(VideoAnalytics.views).label("views"),
            func.sum(VideoAnalytics.estimated_revenue).label("revenue"),
        )
        .where(
            and_(
                VideoAnalytics.date >= start_date.date(),
                VideoAnalytics.date <= end_date.date(),
            )
        )
        .group_by(VideoAnalytics.date)
        .order_by(VideoAnalytics.date)
    )

    stats_by_date = {
        row.date: {
            "views": int(row.views or 0),
            "revenue": float(row.revenue or 0),
        }
        for row in video_stats.all()
    }

    # Videos published by date
    videos_published = await db.execute(
        select(
            func.date(Video.published_at).label("date"),
            func.count(Video.id).label("count"),
        )
        .where(
            and_(
                Video.published_at >= start_date,
                Video.published_at <= end_date,
            )
        )
        .group_by(func.date(Video.published_at))
    )

    for row in videos_published.all():
        if row.date in stats_by_date:
            stats_by_date[row.date]["videos_published"] = row.count
        else:
            stats_by_date[row.date] = {"videos_published": row.count}

    # FOIAs submitted by date
    foias_submitted = await db.execute(
        select(
            func.date(FoiaRequest.submitted_at).label("date"),
            func.count(FoiaRequest.id).label("count"),
        )
        .where(
            and_(
                FoiaRequest.submitted_at >= start_date,
                FoiaRequest.submitted_at <= end_date,
            )
        )
        .group_by(func.date(FoiaRequest.submitted_at))
    )

    for row in foias_submitted.all():
        if row.date in stats_by_date:
            stats_by_date[row.date]["foias_submitted"] = row.count
        else:
            stats_by_date[row.date] = {"foias_submitted": row.count}

    # Articles created by date
    articles_created = await db.execute(
        select(
            func.date(NewsArticle.created_at).label("date"),
            func.count(NewsArticle.id).label("count"),
        )
        .where(
            and_(
                NewsArticle.created_at >= start_date,
                NewsArticle.created_at <= end_date,
            )
        )
        .group_by(func.date(NewsArticle.created_at))
    )

    for row in articles_created.all():
        if row.date in stats_by_date:
            stats_by_date[row.date]["articles_scanned"] = row.count
        else:
            stats_by_date[row.date] = {"articles_scanned": row.count}

    # Write data rows
    for date in sorted(stats_by_date.keys()):
        stats = stats_by_date[date]
        writer.writerow([
            date.isoformat(),
            stats.get("views", 0),
            f"{stats.get('revenue', 0):.2f}",
            stats.get("videos_published", 0),
            stats.get("foias_submitted", 0),
            stats.get("articles_scanned", 0),
        ])

    return output.getvalue().encode("utf-8")
