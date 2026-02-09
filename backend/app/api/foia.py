"""FOIA requests router – full CRUD, submission, PDF generation, and reporting."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.agency import Agency
from app.models.foia_request import FoiaPriority, FoiaRequest, FoiaStatus
from app.models.news_article import NewsArticle
from app.schemas.foia import (
    FoiaDeadline,
    FoiaRequestCreate,
    FoiaRequestList,
    FoiaRequestResponse,
    FoiaRequestUpdate,
    FoiaStatusSummary,
)
from app.services.email_sender import send_foia_email
from app.services.foia_generator import (
    assign_case_number,
    generate_pdf,
    generate_request_text,
)

router = APIRouter(prefix="/api/foia", tags=["foia"])

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


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


# ── Reporting endpoints (registered before /{foia_id} to avoid conflicts) ─


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
    stmt = select(FoiaRequest)
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


@router.get("/{foia_id}", response_model=FoiaRequestResponse)
async def get_foia_request(
    foia_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> FoiaRequestResponse:
    """Return full detail of a single FOIA request."""
    foia = await db.get(FoiaRequest, foia_id)
    if not foia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FOIA request not found"
        )
    return _to_response(foia)


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
            )
        else:
            request_text = generate_request_text(
                incident_description="the referenced incident",
                agency_name=agency.name,
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
async def submit_foia_request(
    foia_id: uuid.UUID,
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

    # Update FOIA record
    foia.status = FoiaStatus.submitted
    foia.submitted_at = datetime.now(timezone.utc)
    foia.pdf_storage_key = f"foia/{foia.case_number}.pdf"
    await db.flush()
    await db.refresh(foia)

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

    pdf_bytes = generate_pdf(foia.request_text, foia.case_number)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{foia.case_number}.pdf"'
        },
    )
