"""News scanner router – article listing, classification, scan triggers, and FOIA filing."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.rate_limit import limiter
from app.models.agency import Agency
from app.models.app_setting import AppSetting
from app.models.foia_request import FoiaRequest, FoiaPriority, FoiaStatus
from app.models.news_article import IncidentType, NewsArticle
from app.models.scan_log import ScanLog, ScanStatus, ScanType
from app.schemas.news import (
    BulkActionRequest,
    BulkActionResponse,
    FileFoiaFromArticle,
    FileFoiaResponse,
    NewsArticleList,
    NewsArticleResponse,
    NewsArticleUpdate,
    NewsScanStatus,
    ScanLogList,
    ScanLogResponse,
    ScanNowResponse,
)
from app.services.article_classifier import classify_and_score_article
from app.services.foia_generator import assign_case_number, generate_request_text
from app.services.news_scanner import scan_all_rss

router = APIRouter(prefix="/api/news", tags=["news"])


# ── GET /api/news — paginated article list ───────────────────────────────


@router.get("", response_model=NewsArticleList)
async def list_articles(
    source: str | None = Query(None, description="Filter by news source"),
    incident_type: IncidentType | None = Query(None, description="Filter by incident type"),
    severity_min: int | None = Query(None, ge=1, le=10, description="Minimum severity score"),
    is_reviewed: bool | None = Query(None, description="Filter by reviewed status"),
    is_dismissed: bool | None = Query(None, description="Filter by dismissed status"),
    auto_foia_eligible: bool | None = Query(None, description="Filter by auto-FOIA eligibility"),
    date_from: datetime | None = Query(None, description="Published after this date"),
    date_to: datetime | None = Query(None, description="Published before this date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("published_at", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsArticleList:
    """Return a paginated, filterable list of news articles."""
    stmt = select(NewsArticle)
    count_stmt = select(func.count(NewsArticle.id))

    # Apply filters
    filters = []

    if source is not None:
        filters.append(NewsArticle.source == source)
    if incident_type is not None:
        filters.append(NewsArticle.incident_type == incident_type)
    if severity_min is not None:
        filters.append(NewsArticle.severity_score >= severity_min)
    if is_reviewed is not None:
        filters.append(NewsArticle.is_reviewed == is_reviewed)
    if is_dismissed is not None:
        filters.append(NewsArticle.is_dismissed == is_dismissed)
    if auto_foia_eligible is not None:
        filters.append(NewsArticle.auto_foia_eligible == auto_foia_eligible)
    if date_from is not None:
        filters.append(NewsArticle.published_at >= date_from)
    if date_to is not None:
        filters.append(NewsArticle.published_at <= date_to)

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    # Sorting
    allowed_sort_fields = {
        "published_at": NewsArticle.published_at,
        "severity_score": NewsArticle.severity_score,
        "created_at": NewsArticle.created_at,
        "headline": NewsArticle.headline,
        "source": NewsArticle.source,
    }
    sort_column = allowed_sort_fields.get(sort_by, NewsArticle.published_at)
    if sort_dir.lower() == "asc":
        stmt = stmt.order_by(sort_column.asc().nullslast())
    else:
        stmt = stmt.order_by(sort_column.desc().nullslast())

    # Count total
    total = (await db.execute(count_stmt)).scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await db.execute(stmt)
    articles = result.scalars().all()

    return NewsArticleList(
        items=[NewsArticleResponse.model_validate(a) for a in articles],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── GET /api/news/scan-status ────────────────────────────────────────────


@router.get("/scan-status", response_model=NewsScanStatus)
async def scan_status(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsScanStatus:
    """Return info about the last scan and whether a scan is currently running."""
    # Check if a scan is currently running
    running_result = await db.execute(
        select(ScanLog)
        .where(ScanLog.scan_type == ScanType.rss, ScanLog.status == ScanStatus.running)
        .order_by(ScanLog.started_at.desc())
        .limit(1)
    )
    running_scan = running_result.scalar_one_or_none()

    # Get last completed scan
    last_result = await db.execute(
        select(ScanLog)
        .where(ScanLog.scan_type == ScanType.rss, ScanLog.status == ScanStatus.completed)
        .order_by(ScanLog.completed_at.desc())
        .limit(1)
    )
    last_scan = last_result.scalar_one_or_none()

    last_scan_at = last_scan.completed_at if last_scan else None
    articles_found = last_scan.articles_found if last_scan else 0

    # Read scan interval from settings (default 30 minutes to match beat schedule)
    interval_setting = (
        await db.execute(
            select(AppSetting).where(AppSetting.key == "scan_interval_minutes")
        )
    ).scalar_one_or_none()
    scan_interval = int(interval_setting.value) if interval_setting and interval_setting.value else 30

    next_scan_at = None
    if last_scan_at:
        next_scan_at = last_scan_at + timedelta(minutes=scan_interval)

    return NewsScanStatus(
        last_scan_at=last_scan_at,
        next_scan_at=next_scan_at,
        is_scanning=running_scan is not None,
        articles_found_last_scan=articles_found,
    )


# ── POST /api/news/scan-now ─────────────────────────────────────────────


@router.post("/scan-now", response_model=ScanNowResponse)
@limiter.limit("3/minute")
async def scan_now(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> ScanNowResponse:
    """Manually trigger an RSS scan and classify all newly found articles."""
    # Run the RSS scan
    stats = await scan_all_rss(db)

    # Classify all unclassified articles (those just created by the scan)
    result = await db.execute(
        select(NewsArticle).where(NewsArticle.incident_type.is_(None))
    )
    unclassified = result.scalars().all()

    classified_count = 0
    for article in unclassified:
        await classify_and_score_article(article, db)
        classified_count += 1

    await db.commit()

    return ScanNowResponse(
        found=stats["found"],
        new=stats["new"],
        duplicate=stats["duplicate"],
        filtered=stats.get("filtered", 0),
        errors=stats["errors"],
        classified=classified_count,
    )


# ── POST /api/news/bulk-action ───────────────────────────────────────────


@router.post("/bulk-action", response_model=BulkActionResponse)
async def bulk_action(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> BulkActionResponse:
    """Perform a bulk action on multiple articles."""
    if body.action not in ("dismiss", "file_foia", "mark_reviewed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown action: {body.action}. Allowed: dismiss, file_foia, mark_reviewed",
        )

    result = await db.execute(
        select(NewsArticle).where(NewsArticle.id.in_(body.article_ids))
    )
    articles = result.scalars().all()

    if not articles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No articles found for the given IDs",
        )

    affected = 0

    if body.action == "dismiss":
        for article in articles:
            article.is_dismissed = True
            affected += 1

    elif body.action == "mark_reviewed":
        for article in articles:
            article.is_reviewed = True
            affected += 1

    elif body.action == "file_foia":
        for article in articles:
            if not article.detected_agency:
                continue

            # Look up the agency
            agency_result = await db.execute(
                select(Agency).where(Agency.name == article.detected_agency).limit(1)
            )
            agency = agency_result.scalar_one_or_none()
            if not agency:
                continue

            # Create FOIA request
            case_number = await assign_case_number(db)
            request_text = generate_request_text(
                incident_description=article.headline or "incident",
                incident_date=(
                    article.published_at.strftime("%B %d, %Y")
                    if article.published_at else None
                ),
                agency_name=agency.name,
                custom_template=agency.foia_template,
            )

            foia = FoiaRequest(
                case_number=case_number,
                agency_id=agency.id,
                news_article_id=article.id,
                status=FoiaStatus.draft,
                priority=FoiaPriority.medium,
                request_text=request_text,
                is_auto_submitted=False,
            )
            db.add(foia)
            article.auto_foia_filed = True
            affected += 1

    await db.flush()

    return BulkActionResponse(
        affected=affected,
        action=body.action,
        details=f"Successfully applied '{body.action}' to {affected} article(s)",
    )


# ── GET /api/news/scan-logs ─────────────────────────────────────────────


@router.get("/scan-logs", response_model=ScanLogList)
async def list_scan_logs(
    scan_type: str | None = Query(None, description="Filter by scan type: rss, scrape, imap"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> ScanLogList:
    """Return paginated scan history logs."""
    stmt = select(ScanLog)
    count_stmt = select(func.count(ScanLog.id))

    if scan_type:
        stmt = stmt.where(ScanLog.scan_type == scan_type)
        count_stmt = count_stmt.where(ScanLog.scan_type == scan_type)
    if status_filter:
        stmt = stmt.where(ScanLog.status == status_filter)
        count_stmt = count_stmt.where(ScanLog.status == status_filter)

    total = (await db.execute(count_stmt)).scalar_one()
    offset = (page - 1) * page_size
    stmt = stmt.order_by(ScanLog.started_at.desc()).offset(offset).limit(page_size)

    logs = (await db.execute(stmt)).scalars().all()

    return ScanLogList(
        items=[ScanLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── GET /api/news/{article_id} ──────────────────────────────────────────


@router.get("/{article_id}", response_model=NewsArticleResponse)
async def get_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsArticleResponse:
    """Return a single news article by ID."""
    article = await db.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Article not found"
        )
    return NewsArticleResponse.model_validate(article)


# ── PATCH /api/news/{article_id} ────────────────────────────────────────


@router.patch("/{article_id}", response_model=NewsArticleResponse)
async def update_article(
    article_id: uuid.UUID,
    body: NewsArticleUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsArticleResponse:
    """Update an article's review/dismiss status."""
    article = await db.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Article not found"
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(article, field, value)

    await db.flush()
    await db.refresh(article)
    return NewsArticleResponse.model_validate(article)


# ── POST /api/news/{article_id}/file-foia ────────────────────────────────


@router.post("/{article_id}/prioritize")
async def prioritize_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Compute predicted revenue and priority factors for an article."""
    from app.services.article_prioritizer import prioritize_article as _prioritize
    result = await _prioritize(db, str(article_id))
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


@router.post("/{article_id}/file-foia", response_model=FileFoiaResponse, status_code=status.HTTP_201_CREATED)
async def file_foia_from_article(
    article_id: uuid.UUID,
    body: FileFoiaFromArticle | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FileFoiaResponse:
    """Create a draft FOIA request from a news article."""
    article = await db.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Article not found"
        )

    # Determine agency
    agency: Agency | None = None

    if body and body.agency_id:
        agency = await db.get(Agency, body.agency_id)
        if not agency:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
            )
    elif article.detected_agency:
        result = await db.execute(
            select(Agency).where(Agency.name == article.detected_agency).limit(1)
        )
        agency = result.scalar_one_or_none()

    if not agency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No agency could be determined. Please provide an agency_id.",
        )

    # Generate case number and request text
    case_number = await assign_case_number(db)
    request_text = generate_request_text(
        incident_description=article.headline or "incident",
        incident_date=(
            article.published_at.strftime("%B %d, %Y")
            if article.published_at else None
        ),
        agency_name=agency.name,
        custom_template=agency.foia_template,
    )

    foia = FoiaRequest(
        case_number=case_number,
        agency_id=agency.id,
        news_article_id=article.id,
        status=FoiaStatus.draft,
        priority=FoiaPriority.medium,
        request_text=request_text,
        is_auto_submitted=False,
    )
    db.add(foia)

    article.auto_foia_filed = True

    await db.flush()
    await db.refresh(foia)

    return FileFoiaResponse(
        foia_request_id=foia.id,
        case_number=foia.case_number,
        agency_name=agency.name,
        status=foia.status.value,
        request_text=foia.request_text,
        created_at=foia.created_at,
    )
