"""Pydantic schemas for FOIA request endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.foia_request import FoiaPriority, FoiaStatus


# ── Create / Update ──────────────────────────────────────────────────────


class FoiaRequestCreate(BaseModel):
    agency_id: uuid.UUID
    news_article_id: uuid.UUID | None = None
    request_text: str | None = None  # auto-generate if not provided
    priority: FoiaPriority | None = None


class FoiaRequestUpdate(BaseModel):
    status: FoiaStatus | None = None
    notes: str | None = None
    priority: FoiaPriority | None = None
    agency_reference_number: str | None = None
    estimated_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    payment_status: str | None = None


# ── Responses ─────────────────────────────────────────────────────────────


class FoiaRequestResponse(BaseModel):
    id: uuid.UUID
    case_number: str
    agency_id: uuid.UUID
    agency_name: str | None = None
    news_article_id: uuid.UUID | None = None
    article_headline: str | None = None
    status: FoiaStatus
    priority: FoiaPriority
    request_text: str
    pdf_storage_key: str | None = None
    submitted_at: datetime | None = None
    acknowledged_at: datetime | None = None
    due_date: datetime | None = None
    fulfilled_at: datetime | None = None
    agency_reference_number: str | None = None
    estimated_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    payment_status: str | None = None
    notes: str | None = None
    is_auto_submitted: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class FoiaRequestList(BaseModel):
    items: list[FoiaRequestResponse]
    total: int
    page: int
    page_size: int


class FoiaStatusSummary(BaseModel):
    counts: dict[str, int]


class FoiaDeadline(BaseModel):
    id: uuid.UUID
    case_number: str
    agency_name: str
    due_date: datetime
    days_remaining: int
    status: FoiaStatus
