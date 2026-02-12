"""Global cross-resource search endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.agency import Agency
from app.models.foia_request import FoiaRequest
from app.models.news_article import NewsArticle
from app.models.video import Video

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(..., min_length=2, max_length=200),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Search across all resource types (FOIA, articles, videos, agencies)."""
    pattern = f"%{q}%"
    limit = 5

    # FOIA requests
    foia_stmt = (
        select(FoiaRequest.id, FoiaRequest.case_number, FoiaRequest.status)
        .where(
            FoiaRequest.case_number.ilike(pattern)
            | FoiaRequest.request_text.ilike(pattern)
        )
        .order_by(FoiaRequest.created_at.desc())
        .limit(limit)
    )
    foia_rows = (await db.execute(foia_stmt)).all()

    # Articles
    article_stmt = (
        select(NewsArticle.id, NewsArticle.headline, NewsArticle.source)
        .where(
            NewsArticle.headline.ilike(pattern)
            | NewsArticle.source.ilike(pattern)
            | NewsArticle.url.ilike(pattern)
        )
        .order_by(NewsArticle.created_at.desc())
        .limit(limit)
    )
    article_rows = (await db.execute(article_stmt)).all()

    # Videos
    video_stmt = (
        select(Video.id, Video.title, Video.status)
        .where(
            Video.title.ilike(pattern)
            | Video.description.ilike(pattern)
        )
        .order_by(Video.created_at.desc())
        .limit(limit)
    )
    video_rows = (await db.execute(video_stmt)).all()

    # Agencies
    agency_stmt = (
        select(Agency.id, Agency.name, Agency.foia_email)
        .where(
            Agency.name.ilike(pattern)
            | Agency.foia_email.ilike(pattern)
        )
        .order_by(Agency.name)
        .limit(limit)
    )
    agency_rows = (await db.execute(agency_stmt)).all()

    return {
        "results": {
            "foia": [
                {
                    "id": str(r.id),
                    "case_number": r.case_number,
                    "status": r.status.value if hasattr(r.status, "value") else r.status,
                }
                for r in foia_rows
            ],
            "articles": [
                {"id": str(r.id), "headline": r.headline, "source": r.source}
                for r in article_rows
            ],
            "videos": [
                {
                    "id": str(r.id),
                    "title": r.title,
                    "status": r.status.value if hasattr(r.status, "value") else r.status,
                }
                for r in video_rows
            ],
            "agencies": [
                {"id": str(r.id), "name": r.name, "email": r.foia_email}
                for r in agency_rows
            ],
        }
    }
