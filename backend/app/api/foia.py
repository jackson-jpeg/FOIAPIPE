"""FOIA requests router – full CRUD, submission, PDF generation, and reporting."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path as FilePath

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.rate_limit import limiter
from app.models.agency import Agency
from app.models.foia_request import FoiaPriority, FoiaRequest, FoiaStatus
from app.models.foia_status_change import FoiaStatusChange
from app.models.news_article import NewsArticle
from app.schemas.foia import (
    FoiaDeadline,
    FoiaLinkedVideo,
    FoiaRequestCreate,
    FoiaRequestDetail,
    FoiaRequestList,
    FoiaRequestResponse,
    FoiaRequestUpdate,
    FoiaStatusChangeResponse,
    FoiaStatusSummary,
)
from app.services.email_sender import send_foia_email
from app.services.foia_generator import (
    assign_case_number,
    generate_pdf,
    generate_request_text,
)
from app.services.cost_predictor import predict_foia_cost, calculate_roi_projection
from app.models.news_article import IncidentType
from app.services.appeal_generator import (
    DenialReason,
    generate_appeal_text,
    generate_appeal_pdf,
    get_appeal_recommendations,
)
from app.services.ai_client import generate_foia_suggestions, generate_followup_letter, apply_foia_suggestion
from app.services.cache import LockError, distributed_lock, publish_sse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/foia", tags=["foia"])

TEMPLATES_DIR = FilePath(__file__).resolve().parent.parent / "templates"


# ── Helpers ──────────────────────────────────────────────────────────────


def _to_response(foia: FoiaRequest) -> FoiaRequestResponse:
    """Convert a FoiaRequest ORM instance to the API response schema."""
    agency_name = foia.agency.name if foia.agency else None
    article_headline = None
    if foia.news_article:
        article_headline = foia.news_article.headline
    return FoiaRequestResponse(
        id=foia.id,
        case_number=foia.case_number,
        agency_id=foia.agency_id,
        agency_name=agency_name,
        news_article_id=foia.news_article_id,
        article_headline=article_headline,
        status=foia.status,
        priority=foia.priority,
        request_text=foia.request_text,
        pdf_storage_key=foia.pdf_storage_key,
        submitted_at=foia.submitted_at,
        acknowledged_at=foia.acknowledged_at,
        due_date=foia.due_date,
        fulfilled_at=foia.fulfilled_at,
        agency_reference_number=foia.agency_reference_number,
        estimated_cost=foia.estimated_cost,
        actual_cost=foia.actual_cost,
        payment_status=foia.payment_status,
        notes=foia.notes,
        is_auto_submitted=foia.is_auto_submitted,
        created_at=foia.created_at,
        updated_at=foia.updated_at,
    )


def _to_detail_response(foia: FoiaRequest) -> FoiaRequestDetail:
    """Convert a FoiaRequest ORM instance to the enriched detail response."""
    base = _to_response(foia)
    return FoiaRequestDetail(
        **base.model_dump(),
        response_emails=foia.response_emails or [],
        status_changes=[
            FoiaStatusChangeResponse.model_validate(sc)
            for sc in (foia.status_changes or [])
        ],
        linked_videos=[
            FoiaLinkedVideo(
                id=v.id,
                title=v.title,
                status=v.status.value if hasattr(v.status, "value") else v.status,
                youtube_video_id=v.youtube_video_id,
                youtube_url=v.youtube_url,
            )
            for v in (foia.videos or [])
        ],
    )


# ── Reporting endpoints (registered before /{foia_id} to avoid conflicts) ─


@router.get("/inbox")
async def inbox(
    response_type: str | None = Query(None, description="Filter by response type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Return a flat, paginated list of all email responses across FOIA requests."""
    stmt = (
        select(FoiaRequest)
        .where(FoiaRequest.response_emails.isnot(None))
        .options(selectinload(FoiaRequest.agency))
    )
    result = await db.execute(stmt)
    requests = result.scalars().all()

    # Flatten all response_emails, enriching each with FOIA context
    all_emails: list[dict] = []
    for foia in requests:
        if not foia.response_emails:
            continue
        agency_name = foia.agency.name if foia.agency else "Unknown"
        for email in foia.response_emails:
            entry = {
                **email,
                "foia_id": str(foia.id),
                "case_number": foia.case_number,
                "agency_name": agency_name,
                "foia_status": foia.status.value,
            }
            all_emails.append(entry)

    # Filter by response_type if provided
    if response_type:
        all_emails = [e for e in all_emails if e.get("response_type") == response_type]

    # Sort by date descending (newest first)
    def sort_key(e: dict) -> str:
        return e.get("date") or ""
    all_emails.sort(key=sort_key, reverse=True)

    # Paginate
    total = len(all_emails)
    start = (page - 1) * page_size
    end = start + page_size
    items = all_emails[start:end]

    # Summary counts by response type
    type_counts: dict[str, int] = {}
    for e in all_emails:
        rt = e.get("response_type", "unknown")
        type_counts[rt] = type_counts.get(rt, 0) + 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "type_counts": type_counts,
    }


@router.get("/status-summary", response_model=FoiaStatusSummary)
async def status_summary(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FoiaStatusSummary:
    """Return counts of FOIA requests grouped by status."""
    rows = (
        await db.execute(
            select(FoiaRequest.status, func.count(FoiaRequest.id)).group_by(
                FoiaRequest.status
            )
        )
    ).all()
    counts: dict[str, int] = {row[0].value: row[1] for row in rows}
    # Ensure every status key is present
    for s in FoiaStatus:
        counts.setdefault(s.value, 0)
    return FoiaStatusSummary(counts=counts)


@router.get("/deadlines", response_model=list[FoiaDeadline])
async def upcoming_deadlines(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> list[FoiaDeadline]:
    """Return FOIA requests with upcoming due dates, sorted by date."""
    now = datetime.now(timezone.utc)
    stmt = (
        select(FoiaRequest)
        .where(
            FoiaRequest.due_date.isnot(None),
            FoiaRequest.status.notin_([FoiaStatus.fulfilled, FoiaStatus.closed, FoiaStatus.denied]),
        )
        .order_by(FoiaRequest.due_date.asc())
    )
    result = await db.execute(stmt)
    requests = result.scalars().all()

    deadlines = []
    for req in requests:
        agency_name = req.agency.name if req.agency else "Unknown"
        days_remaining = (req.due_date - now).days
        deadlines.append(
            FoiaDeadline(
                id=req.id,
                case_number=req.case_number,
                agency_name=agency_name,
                due_date=req.due_date,
                days_remaining=days_remaining,
                status=req.status,
            )
        )
    return deadlines


@router.get("/cost-prediction")
async def predict_cost(
    agency_id: uuid.UUID,
    incident_type: IncidentType | None = Query(None, description="Type of incident"),
    estimated_duration_minutes: int | None = Query(None, ge=1, le=300, description="Estimated footage duration in minutes"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Predict the cost of a FOIA request based on historical data.

    Uses multiple data sources in priority order:
    1. Agency-specific historical average (highest confidence)
    2. Incident type historical average
    3. Agency's typical cost per hour
    4. Default estimates by incident type

    Returns prediction with confidence level and cost range.
    """
    prediction = await predict_foia_cost(
        db=db,
        agency_id=str(agency_id),
        incident_type=incident_type,
        estimated_duration_minutes=estimated_duration_minutes,
    )
    return prediction


@router.get("/roi-projection")
async def roi_projection(
    predicted_cost: float = Query(..., ge=0, description="Predicted FOIA cost in dollars"),
    incident_type: IncidentType | None = Query(None, description="Type of incident"),
    virality_score: int | None = Query(None, ge=1, le=10, description="Predicted virality score (1-10)"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Project potential ROI for a FOIA request.

    Uses historical performance data to estimate revenue and calculate ROI.
    Provides recommendation (STRONG YES, YES, MAYBE, CAUTION) based on profitability.
    """
    projection = await calculate_roi_projection(
        db=db,
        predicted_cost=predicted_cost,
        incident_type=incident_type,
        virality_score=virality_score,
    )
    return projection


# ── AI Suggestions ────────────────────────────────────────────────────────


@router.post("/suggestions/preview")
async def preview_suggestions(
    body: dict,
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate AI suggestions for unsaved FOIA request text.

    Body should contain:
    - request_text: The FOIA request text to analyze
    - agency_name: Optional agency name for context
    - incident_type: Optional incident type for context
    """
    request_text = body.get("request_text", "")
    if not request_text or len(request_text.split()) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request text must contain at least 10 words",
        )

    suggestions = await generate_foia_suggestions(
        request_text=request_text,
        agency_name=body.get("agency_name", ""),
        incident_type=body.get("incident_type", ""),
    )
    return {"suggestions": suggestions}


@router.post("/{foia_id}/suggestions")
async def get_suggestions(
    foia_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate AI suggestions for an existing FOIA request."""
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    agency_name = foia.agency.name if foia.agency else ""
    incident_type = ""
    if foia.news_article and hasattr(foia.news_article, "incident_type"):
        incident_type = foia.news_article.incident_type.value if foia.news_article.incident_type else ""

    suggestions = await generate_foia_suggestions(
        request_text=foia.request_text or "",
        agency_name=agency_name,
        incident_type=incident_type,
    )
    return {"suggestions": suggestions}


@router.post("/suggestions/apply")
async def apply_suggestion(
    body: dict,
    _user: str = Depends(get_current_user),
) -> dict:
    """Apply a single AI suggestion to FOIA request text.

    Body should contain:
    - request_text: The current FOIA request text
    - suggestion: The suggestion to apply
    """
    request_text = body.get("request_text", "")
    suggestion = body.get("suggestion", "")
    if not request_text or not suggestion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both request_text and suggestion are required",
        )

    improved_text = await apply_foia_suggestion(
        request_text=request_text,
        suggestion=suggestion,
    )
    return {"request_text": improved_text}


# ── Follow-up Generation ──────────────────────────────────────────────────


@router.post("/{foia_id}/generate-followup")
async def generate_followup(
    foia_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate a follow-up letter for an overdue FOIA request.

    Only available for submitted/acknowledged/processing requests that are past due.
    """
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    if foia.status not in (FoiaStatus.submitted, FoiaStatus.acknowledged, FoiaStatus.processing):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate follow-up for request with status '{foia.status.value}'.",
        )

    now = datetime.now(timezone.utc)
    if not foia.due_date or foia.due_date > now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is not yet overdue.",
        )

    days_overdue = (now - foia.due_date).days
    agency_name = foia.agency.name if foia.agency else "Unknown Agency"

    # Get last response type if available
    last_response_type = None
    if foia.response_emails and len(foia.response_emails) > 0:
        last_response_type = foia.response_emails[-1].get("response_type")

    followup_text = await generate_followup_letter(
        original_request_text=foia.request_text or "",
        case_number=foia.case_number,
        agency_name=agency_name,
        days_overdue=days_overdue,
        last_response_type=last_response_type,
    )

    return {
        "followup_text": followup_text,
        "days_overdue": days_overdue,
        "case_number": foia.case_number,
    }


# ── Attachment URL ────────────────────────────────────────────────────────


@router.get("/{foia_id}/attachment-url")
async def get_attachment_url(
    foia_id: uuid.UUID,
    key: str = Query(..., description="S3 object key for the attachment"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate a presigned URL for downloading a FOIA email attachment."""
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    # Security: only allow attachment keys
    if not key.startswith("foia/attachments/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attachment key.",
        )

    from app.services.storage import generate_presigned_url

    try:
        url = generate_presigned_url(key, expiry=3600)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}",
        )

    # Extract filename from key
    filename = key.rsplit("/", 1)[-1] if "/" in key else key

    return {"url": url, "filename": filename}


# ── List & Detail ────────────────────────────────────────────────────────


@router.get("", response_model=FoiaRequestList)
async def list_foia_requests(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: FoiaStatus | None = Query(None, alias="status", description="Filter by status"),
    agency_id: uuid.UUID | None = Query(None, description="Filter by agency"),
    priority: FoiaPriority | None = Query(None, description="Filter by priority"),
    date_from: datetime | None = Query(None, description="Created after this date"),
    date_to: datetime | None = Query(None, description="Created before this date"),
    has_news_article: bool | None = Query(None, description="Filter by linked article"),
    search: str | None = Query(None, description="Search by case number"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FoiaRequestList:
    """Return a paginated list of FOIA requests with filters."""
    stmt = select(FoiaRequest).options(
        selectinload(FoiaRequest.agency),
        selectinload(FoiaRequest.news_article),
    )
    count_stmt = select(func.count(FoiaRequest.id))

    # Apply filters
    if status_filter is not None:
        stmt = stmt.where(FoiaRequest.status == status_filter)
        count_stmt = count_stmt.where(FoiaRequest.status == status_filter)
    if agency_id is not None:
        stmt = stmt.where(FoiaRequest.agency_id == agency_id)
        count_stmt = count_stmt.where(FoiaRequest.agency_id == agency_id)
    if priority is not None:
        stmt = stmt.where(FoiaRequest.priority == priority)
        count_stmt = count_stmt.where(FoiaRequest.priority == priority)
    if date_from is not None:
        stmt = stmt.where(FoiaRequest.created_at >= date_from)
        count_stmt = count_stmt.where(FoiaRequest.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(FoiaRequest.created_at <= date_to)
        count_stmt = count_stmt.where(FoiaRequest.created_at <= date_to)
    if has_news_article is not None:
        if has_news_article:
            stmt = stmt.where(FoiaRequest.news_article_id.isnot(None))
            count_stmt = count_stmt.where(FoiaRequest.news_article_id.isnot(None))
        else:
            stmt = stmt.where(FoiaRequest.news_article_id.is_(None))
            count_stmt = count_stmt.where(FoiaRequest.news_article_id.is_(None))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(FoiaRequest.case_number.ilike(pattern))
        count_stmt = count_stmt.where(FoiaRequest.case_number.ilike(pattern))

    # Sort
    sort_column = getattr(FoiaRequest, sort_by, FoiaRequest.created_at)
    if sort_dir.lower() == "asc":
        stmt = stmt.order_by(sort_column.asc())
    else:
        stmt = stmt.order_by(sort_column.desc())

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(stmt)
    requests = result.scalars().all()

    return FoiaRequestList(
        items=[_to_response(r) for r in requests],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{foia_id}", response_model=FoiaRequestDetail)
async def get_foia_request(
    foia_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FoiaRequestDetail:
    """Return full detail of a single FOIA request with related data."""
    stmt = (
        select(FoiaRequest)
        .where(FoiaRequest.id == foia_id)
        .options(
            selectinload(FoiaRequest.agency),
            selectinload(FoiaRequest.news_article),
            selectinload(FoiaRequest.videos),
            selectinload(FoiaRequest.status_changes),
        )
    )
    foia = (await db.execute(stmt)).scalar_one_or_none()
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )
    return _to_detail_response(foia)


# ── Create & Update ─────────────────────────────────────────────────────


@router.post("", response_model=FoiaRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_foia_request(
    body: FoiaRequestCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FoiaRequestResponse:
    """Create a new FOIA request. Auto-generates request text from article if not provided."""
    # Validate agency exists
    agency = await db.get(Agency, body.agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )

    # Duplicate guard: same agency + same article
    if body.news_article_id:
        existing = (
            await db.execute(
                select(FoiaRequest).where(
                    and_(
                        FoiaRequest.agency_id == body.agency_id,
                        FoiaRequest.news_article_id == body.news_article_id,
                    )
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A FOIA request already exists for this agency and article (case {existing.case_number}).",
            )

    # Auto-generate case number
    case_number = await assign_case_number(db)

    # Determine request text
    request_text = body.request_text
    if not request_text:
        # Try to generate from linked news article
        article = None
        if body.news_article_id:
            article = await db.get(NewsArticle, body.news_article_id)

        if article:
            incident_description = article.headline
            incident_date = (
                article.published_at.strftime("%B %d, %Y") if article.published_at else None
            )
            incident_location = article.detected_location
            officer_names = article.detected_officers if isinstance(article.detected_officers, list) else None
            request_text = generate_request_text(
                incident_description=incident_description,
                incident_date=incident_date,
                incident_location=incident_location,
                agency_name=agency.name,
                officer_names=officer_names,
                custom_template=agency.foia_template,
            )
        else:
            request_text = generate_request_text(
                incident_description="the referenced incident",
                agency_name=agency.name,
                custom_template=agency.foia_template,
            )

    foia = FoiaRequest(
        case_number=case_number,
        agency_id=body.agency_id,
        news_article_id=body.news_article_id,
        status=FoiaStatus.draft,
        priority=body.priority or FoiaPriority.medium,
        request_text=request_text,
    )
    db.add(foia)
    await db.flush()
    await db.refresh(foia)
    return _to_response(foia)


@router.patch("/{foia_id}", response_model=FoiaRequestResponse)
async def update_foia_request(
    foia_id: uuid.UUID,
    body: FoiaRequestUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FoiaRequestResponse:
    """Update a FOIA request's mutable fields."""
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(foia, field, value)
    await db.flush()
    await db.refresh(foia)
    return _to_response(foia)


# ── Actions ──────────────────────────────────────────────────────────────


@router.post("/{foia_id}/submit")
@limiter.limit("10/minute")
async def submit_foia_request(
    request: Request,
    foia_id: uuid.UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Submit a FOIA request: generate PDF, email to agency, update status."""
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    if foia.status not in (FoiaStatus.draft, FoiaStatus.ready):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit a request with status '{foia.status.value}'. Must be draft or ready.",
        )

    # Distributed lock to prevent double submission
    try:
        lock_ctx = distributed_lock(f"foia-submit-{foia_id}", timeout=120)
        await lock_ctx.__aenter__()
    except LockError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This FOIA request is already being submitted.",
        )

    # Ensure agency has a FOIA email
    agency = foia.agency
    if not agency or not agency.foia_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agency does not have a FOIA email address configured.",
        )

    # Generate PDF
    pdf_bytes = generate_pdf(foia.request_text, foia.case_number)

    # Build email body from template
    template_path = TEMPLATES_DIR / "foia_email_body.txt"
    if template_path.exists():
        email_body = template_path.read_text().format(
            case_number=foia.case_number,
            request_text=foia.request_text,
        )
    else:
        email_body = (
            f"Case Reference: {foia.case_number}\n\n{foia.request_text}"
        )

    # Send email
    result = await send_foia_email(
        to_email=agency.foia_email,
        subject=f"Public Records Request – {foia.case_number}",
        body_text=email_body,
        pdf_bytes=pdf_bytes,
        pdf_filename=f"{foia.case_number}.pdf",
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send email: {result['message']}",
        )

    # Upload PDF to S3 (CRITICAL — must succeed for audit trail)
    # Retry logic with exponential backoff (3 attempts, 2-10s wait)
    storage_key = f"foia/{foia.case_number}.pdf"
    try:
        from app.services.storage import upload_file
        upload_file(pdf_bytes, storage_key, content_type="application/pdf")
        logger.info(f"S3 upload successful for {storage_key}")
    except Exception as e:
        logger.error(f"S3 upload failed for {storage_key} after retries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store FOIA PDF: {str(e)}",
        )

    # Calculate due date from agency response time (fallback: 30 days)
    response_days = agency.avg_response_days or 30
    now = datetime.now(timezone.utc)

    # Record status change for audit trail (BEFORE updating status)
    audit_entry = FoiaStatusChange(
        foia_request_id=foia.id,
        from_status=foia.status.value,
        to_status=FoiaStatus.submitted.value,
        changed_by=_user,
        reason="Submitted via email",
        extra_metadata={
            "agency_email": agency.foia_email,
            "case_number": foia.case_number,
            "storage_key": storage_key,
        },
    )
    db.add(audit_entry)

    # Update FOIA record
    foia.status = FoiaStatus.submitted
    foia.submitted_at = now
    foia.due_date = now + timedelta(days=response_days)
    foia.pdf_storage_key = storage_key
    await db.flush()

    # Create in-app notification for FOIA submission
    from app.models.notification import Notification, NotificationChannel, NotificationType
    notif = Notification(
        type=NotificationType.foia_submitted,
        channel=NotificationChannel.in_app,
        title=f"FOIA Submitted: {foia.case_number}",
        message=f"Submitted to {agency.name}",
        link="/foia",
    )
    db.add(notif)

    await db.refresh(foia)

    await lock_ctx.__aexit__(None, None, None)

    await publish_sse("foia_submitted", {
        "foia_id": str(foia.id),
        "case_number": foia.case_number,
        "agency_name": agency.name,
    })

    return {
        "success": True,
        "message": f"FOIA request {foia.case_number} submitted to {agency.foia_email}",
        "foia": _to_response(foia).model_dump(mode="json"),
    }


@router.post("/{foia_id}/generate-pdf")
async def regenerate_pdf(
    foia_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> Response:
    """Regenerate the PDF for a FOIA request and return it."""
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    # Try to retrieve stored PDF from S3 first
    pdf_bytes = None
    if foia.pdf_storage_key:
        try:
            from app.services.storage import download_file
            pdf_bytes = download_file(foia.pdf_storage_key)
        except Exception:
            pass  # Fall through to regeneration

    if not pdf_bytes:
        pdf_bytes = generate_pdf(foia.request_text, foia.case_number)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{foia.case_number}.pdf"'
        },
    )


# ── Appeal Generation ─────────────────────────────────────────────────────


@router.post("/{foia_id}/generate-appeal")
async def generate_appeal(
    foia_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate an appeal letter for a denied FOIA request.

    Body should contain:
    - denial_reason: Reason for denial (DenialReason enum value)
    - denial_explanation: Agency's explanation (optional)
    - incident_description: Description of incident (optional)
    """
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    if foia.status != FoiaStatus.denied:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate appeal for request with status '{foia.status.value}'. Must be denied.",
        )

    # Get agency
    agency = foia.agency
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agency not found for this FOIA request",
        )

    # Parse denial reason
    denial_reason_str = body.get("denial_reason")
    if not denial_reason_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="denial_reason is required",
        )

    try:
        denial_reason = DenialReason(denial_reason_str)
    except ValueError:
        valid_reasons = [r.value for r in DenialReason]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid denial_reason. Must be one of: {', '.join(valid_reasons)}",
        )

    denial_explanation = body.get("denial_explanation")
    incident_description = body.get("incident_description")

    # Get incident description from article if not provided
    if not incident_description and foia.news_article:
        incident_description = foia.news_article.headline

    # Generate appeal text
    appeal_text = generate_appeal_text(
        original_request_text=foia.request_text,
        case_number=foia.case_number,
        agency_name=agency.name,
        denial_reason=denial_reason,
        denial_explanation=denial_explanation,
        incident_description=incident_description,
    )

    # Generate appeal number
    appeal_number = f"{foia.case_number}-APPEAL-01"

    # Generate PDF
    appeal_pdf = generate_appeal_pdf(appeal_text, foia.case_number, appeal_number)

    # Get recommendations
    recommendations = get_appeal_recommendations(denial_reason)

    return {
        "appeal_text": appeal_text,
        "appeal_number": appeal_number,
        "denial_reason": denial_reason.value,
        "recommendations": recommendations,
        "original_case_number": foia.case_number,
        "agency_name": agency.name,
        "pdf_size_bytes": len(appeal_pdf),
    }


@router.post("/{foia_id}/download-appeal-pdf")
async def download_appeal_pdf(
    foia_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> Response:
    """Generate and download an appeal PDF.

    Body should contain:
    - denial_reason: Reason for denial (DenialReason enum value)
    - denial_explanation: Agency's explanation (optional)
    - incident_description: Description of incident (optional)
    """
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )

    if foia.status != FoiaStatus.denied:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate appeal for request with status '{foia.status.value}'. Must be denied.",
        )

    # Get agency
    agency = foia.agency
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agency not found for this FOIA request",
        )

    # Parse denial reason
    denial_reason_str = body.get("denial_reason")
    if not denial_reason_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="denial_reason is required",
        )

    try:
        denial_reason = DenialReason(denial_reason_str)
    except ValueError:
        valid_reasons = [r.value for r in DenialReason]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid denial_reason. Must be one of: {', '.join(valid_reasons)}",
        )

    denial_explanation = body.get("denial_explanation")
    incident_description = body.get("incident_description")

    # Get incident description from article if not provided
    if not incident_description and foia.news_article:
        incident_description = foia.news_article.headline

    # Generate appeal text
    appeal_text = generate_appeal_text(
        original_request_text=foia.request_text,
        case_number=foia.case_number,
        agency_name=agency.name,
        denial_reason=denial_reason,
        denial_explanation=denial_explanation,
        incident_description=incident_description,
    )

    # Generate appeal number
    appeal_number = f"{foia.case_number}-APPEAL-01"

    # Generate PDF
    appeal_pdf = generate_appeal_pdf(appeal_text, foia.case_number, appeal_number)

    return Response(
        content=appeal_pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{appeal_number}.pdf"'
        },
    )


@router.get("/appeal-reasons")
async def list_denial_reasons(
    _user: str = Depends(get_current_user),
) -> dict:
    """List all available denial reasons with descriptions.

    Returns denial reasons that can be used when generating appeals.
    """
    return {
        "reasons": [
            {
                "value": reason.value,
                "label": reason.value.replace("_", " ").title(),
                "description": {
                    DenialReason.active_investigation: "Request denied due to active criminal investigation",
                    DenialReason.public_safety: "Request denied citing public safety concerns",
                    DenialReason.privacy: "Request denied to protect privacy interests",
                    DenialReason.excessive_cost: "Request denied due to excessive duplication costs",
                    DenialReason.vague_request: "Request denied as too vague or broad",
                    DenialReason.no_records: "Agency claims no responsive records exist",
                    DenialReason.other: "Other reason or unspecified denial",
                }[reason],
                "recommendations": get_appeal_recommendations(reason),
            }
            for reason in DenialReason
        ]
    }


# ── Batch Submission ──────────────────────────────────────────────────────


@router.post("/batch-submit")
async def batch_submit_foia(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Submit the same FOIA request to multiple agencies at once.

    Body should contain:
    - agency_ids: List of agency UUIDs
    - news_article_id: Optional news article ID
    - request_text: Optional custom request text (same for all agencies)
    - priority: Optional priority level
    - auto_submit: Whether to immediately submit (default: False)

    Returns:
    - created: List of created FOIA requests
    - submitted: List of successfully submitted requests (if auto_submit=True)
    - errors: List of any errors encountered
    """
    agency_ids = body.get("agency_ids", [])
    if not agency_ids or len(agency_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide at least 2 agency IDs for batch submission",
        )

    news_article_id = body.get("news_article_id")
    custom_request_text = body.get("request_text")
    priority = body.get("priority", FoiaPriority.medium.value)
    auto_submit = body.get("auto_submit", False)

    try:
        priority_enum = FoiaPriority(priority)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid priority. Must be one of: {[p.value for p in FoiaPriority]}",
        )

    # Get news article if provided
    article = None
    if news_article_id:
        article = await db.get(NewsArticle, news_article_id)
        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="News article not found",
            )

    created_requests = []
    submitted_requests = []
    errors = []

    # Create FOIA request for each agency
    for agency_id_str in agency_ids:
        try:
            agency_id = uuid.UUID(agency_id_str)

            # Check if agency exists
            agency = await db.get(Agency, agency_id)
            if not agency:
                errors.append({
                    "agency_id": agency_id_str,
                    "error": "Agency not found",
                })
                continue

            # Check for duplicate (same agency + same article)
            if news_article_id:
                existing = (
                    await db.execute(
                        select(FoiaRequest).where(
                            and_(
                                FoiaRequest.agency_id == agency_id,
                                FoiaRequest.news_article_id == news_article_id,
                            )
                        )
                    )
                ).scalar_one_or_none()

                if existing:
                    errors.append({
                        "agency_id": agency_id_str,
                        "error": f"FOIA already exists for this agency and article (case {existing.case_number})",
                    })
                    continue

            # Generate case number
            case_number = await assign_case_number(db)

            # Determine request text
            if custom_request_text:
                request_text = custom_request_text
            elif article:
                # Generate from article
                incident_description = article.headline
                incident_date = (
                    article.published_at.strftime("%B %d, %Y")
                    if article.published_at
                    else None
                )
                incident_location = article.detected_location
                officer_names = (
                    article.detected_officers
                    if isinstance(article.detected_officers, list)
                    else None
                )
                request_text = generate_request_text(
                    incident_description=incident_description,
                    incident_date=incident_date,
                    incident_location=incident_location,
                    agency_name=agency.name,
                    officer_names=officer_names,
                    custom_template=agency.foia_template,
                )
            else:
                # Generic request
                request_text = generate_request_text(
                    incident_description="the referenced incident",
                    agency_name=agency.name,
                    custom_template=agency.foia_template,
                )

            # Create FOIA request
            foia = FoiaRequest(
                case_number=case_number,
                agency_id=agency_id,
                news_article_id=news_article_id,
                status=FoiaStatus.draft if not auto_submit else FoiaStatus.draft,
                priority=priority_enum,
                request_text=request_text,
            )
            db.add(foia)
            await db.flush()
            await db.refresh(foia)

            created_requests.append({
                "id": str(foia.id),
                "case_number": foia.case_number,
                "agency_id": str(agency_id),
                "agency_name": agency.name,
                "status": foia.status.value,
            })

            # Auto-submit if requested
            if auto_submit and agency.foia_email:
                try:
                    # Generate PDF
                    pdf_bytes = generate_pdf(foia.request_text, foia.case_number)

                    # Build email body
                    template_path = TEMPLATES_DIR / "foia_email_body.txt"
                    if template_path.exists():
                        email_body = template_path.read_text().format(
                            case_number=foia.case_number,
                            request_text=foia.request_text,
                        )
                    else:
                        email_body = f"Case Reference: {foia.case_number}\n\n{foia.request_text}"

                    # Send email
                    result = await send_foia_email(
                        to_email=agency.foia_email,
                        subject=f"Public Records Request – {foia.case_number}",
                        body_text=email_body,
                        pdf_bytes=pdf_bytes,
                        pdf_filename=f"{foia.case_number}.pdf",
                    )

                    if result["success"]:
                        # Upload PDF to S3
                        storage_key = f"foia/{foia.case_number}.pdf"
                        try:
                            from app.services.storage import upload_file

                            upload_file(
                                pdf_bytes,
                                storage_key,
                                content_type="application/pdf",
                            )
                        except Exception as e:
                            logger.error(f"S3 upload failed for {storage_key}: {e}")

                        # Update status
                        response_days = agency.avg_response_days or 30
                        now = datetime.now(timezone.utc)

                        foia.status = FoiaStatus.submitted
                        foia.submitted_at = now
                        foia.due_date = now + timedelta(days=response_days)
                        foia.pdf_storage_key = storage_key
                        await db.flush()

                        submitted_requests.append({
                            "id": str(foia.id),
                            "case_number": foia.case_number,
                            "agency_name": agency.name,
                        })
                    else:
                        errors.append({
                            "agency_id": agency_id_str,
                            "case_number": foia.case_number,
                            "error": f"Email failed: {result['message']}",
                        })

                except Exception as e:
                    errors.append({
                        "agency_id": agency_id_str,
                        "case_number": foia.case_number,
                        "error": f"Submission failed: {str(e)}",
                    })

        except Exception as e:
            errors.append({
                "agency_id": agency_id_str,
                "error": str(e),
            })

    await db.commit()

    return {
        "success": len(created_requests) > 0,
        "created_count": len(created_requests),
        "submitted_count": len(submitted_requests),
        "error_count": len(errors),
        "created": created_requests,
        "submitted": submitted_requests,
        "errors": errors,
    }


@router.get("/batch-status")
async def batch_status(
    case_numbers: str = Query(..., description="Comma-separated case numbers"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get status of multiple FOIA requests by case numbers.

    Useful for tracking batch submissions.

    Args:
        case_numbers: Comma-separated list of case numbers

    Returns:
        Status information for each request
    """
    case_number_list = [cn.strip() for cn in case_numbers.split(",") if cn.strip()]

    if not case_number_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide at least one case number",
        )

    # Get all matching requests
    result = await db.execute(
        select(FoiaRequest).where(FoiaRequest.case_number.in_(case_number_list))
    )
    requests = result.scalars().all()

    # Build status map
    status_map = {}
    for foia in requests:
        agency_name = foia.agency.name if foia.agency else "Unknown"
        status_map[foia.case_number] = {
            "id": str(foia.id),
            "case_number": foia.case_number,
            "agency_id": str(foia.agency_id),
            "agency_name": agency_name,
            "status": foia.status.value,
            "priority": foia.priority.value,
            "submitted_at": (
                foia.submitted_at.isoformat() if foia.submitted_at else None
            ),
            "due_date": foia.due_date.isoformat() if foia.due_date else None,
            "fulfilled_at": (
                foia.fulfilled_at.isoformat() if foia.fulfilled_at else None
            ),
            "actual_cost": float(foia.actual_cost) if foia.actual_cost else None,
        }

    # Find missing case numbers
    found_case_numbers = {foia.case_number for foia in requests}
    missing = [cn for cn in case_number_list if cn not in found_case_numbers]

    # Calculate summary stats
    status_counts = {}
    for foia in requests:
        status_value = foia.status.value
        status_counts[status_value] = status_counts.get(status_value, 0) + 1

    total_cost = sum(
        float(foia.actual_cost) for foia in requests if foia.actual_cost
    )

    return {
        "total_requests": len(case_number_list),
        "found": len(requests),
        "missing": missing,
        "status_counts": status_counts,
        "total_cost": round(total_cost, 2),
        "requests": status_map,
    }
