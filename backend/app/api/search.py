"""Global cross-resource search endpoint with PostgreSQL full-text search."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.agency import Agency
from app.models.foia_request import FoiaRequest
from app.models.news_article import NewsArticle
from app.models.video import Video

router = APIRouter(prefix="/api/search", tags=["search"])


def _ts_query(q: str) -> str:
    """Convert user search string to tsquery-compatible format.

    Splits on whitespace and joins with '&' (AND) for multi-word queries.
    Each word is suffixed with ':*' for prefix matching.
    """
    words = q.strip().split()
    if not words:
        return ""
    return " & ".join(f"{word}:*" for word in words)


@router.get("")
async def global_search(
    q: str = Query(..., min_length=2, max_length=200),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Search across all resource types using PostgreSQL full-text search.

    Falls back to ILIKE for databases without tsvector support.
    """
    limit = 5
    ts_q = _ts_query(q)
    pattern = f"%{q}%"

    # ── FOIA requests ──────────────────────────────────────────────────
    if ts_q:
        foia_ts = func.to_tsvector("english", func.coalesce(FoiaRequest.case_number, "") + " " + func.coalesce(FoiaRequest.request_text, ""))
        foia_query = func.to_tsquery("english", ts_q)
        foia_stmt = (
            select(FoiaRequest.id, FoiaRequest.case_number, FoiaRequest.status)
            .where(foia_ts.op("@@")(foia_query))
            .order_by(func.ts_rank(foia_ts, foia_query).desc())
            .limit(limit)
        )
    else:
        foia_stmt = (
            select(FoiaRequest.id, FoiaRequest.case_number, FoiaRequest.status)
            .where(
                FoiaRequest.case_number.ilike(pattern)
                | FoiaRequest.request_text.ilike(pattern)
            )
            .order_by(FoiaRequest.created_at.desc())
            .limit(limit)
        )

    try:
        foia_rows = (await db.execute(foia_stmt)).all()
    except Exception:
        # Fallback to ILIKE if FTS fails
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

    # ── Articles ───────────────────────────────────────────────────────
    if ts_q:
        article_ts = func.to_tsvector("english", func.coalesce(NewsArticle.headline, "") + " " + func.coalesce(NewsArticle.source, ""))
        article_query = func.to_tsquery("english", ts_q)
        article_stmt = (
            select(NewsArticle.id, NewsArticle.headline, NewsArticle.source)
            .where(article_ts.op("@@")(article_query))
            .order_by(func.ts_rank(article_ts, article_query).desc())
            .limit(limit)
        )
    else:
        article_stmt = (
            select(NewsArticle.id, NewsArticle.headline, NewsArticle.source)
            .where(
                NewsArticle.headline.ilike(pattern)
                | NewsArticle.source.ilike(pattern)
            )
            .order_by(NewsArticle.created_at.desc())
            .limit(limit)
        )

    try:
        article_rows = (await db.execute(article_stmt)).all()
    except Exception:
        article_stmt = (
            select(NewsArticle.id, NewsArticle.headline, NewsArticle.source)
            .where(
                NewsArticle.headline.ilike(pattern)
                | NewsArticle.source.ilike(pattern)
            )
            .order_by(NewsArticle.created_at.desc())
            .limit(limit)
        )
        article_rows = (await db.execute(article_stmt)).all()

    # ── Videos ─────────────────────────────────────────────────────────
    if ts_q:
        video_ts = func.to_tsvector("english", func.coalesce(Video.title, "") + " " + func.coalesce(Video.description, ""))
        video_query = func.to_tsquery("english", ts_q)
        video_stmt = (
            select(Video.id, Video.title, Video.status)
            .where(video_ts.op("@@")(video_query))
            .order_by(func.ts_rank(video_ts, video_query).desc())
            .limit(limit)
        )
    else:
        video_stmt = (
            select(Video.id, Video.title, Video.status)
            .where(
                Video.title.ilike(pattern)
                | Video.description.ilike(pattern)
            )
            .order_by(Video.created_at.desc())
            .limit(limit)
        )

    try:
        video_rows = (await db.execute(video_stmt)).all()
    except Exception:
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

    # ── Agencies ───────────────────────────────────────────────────────
    # Agencies are few, ILIKE is fine for small tables
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
