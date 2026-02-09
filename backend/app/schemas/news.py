"""Pydantic schemas for news article endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.news_article import IncidentType


# ── Responses ─────────────────────────────────────────────────────────────


class NewsArticleResponse(BaseModel):
    id: uuid.UUID
    url: str
    headline: str
    source: str
    summary: str | None = None
    body: str | None = None
    published_at: datetime | None = None
    incident_type: IncidentType | None = None
    severity_score: int | None = None
    detected_agency: str | None = None
    detected_officers: list[str] | None = None
    detected_location: str | None = None
    is_reviewed: bool
    is_dismissed: bool
    dismissed_reason: str | None = None
    auto_foia_eligible: bool
    auto_foia_filed: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class NewsArticleList(BaseModel):
    items: list[NewsArticleResponse]
    total: int
    page: int
    page_size: int


# ── Updates / Actions ─────────────────────────────────────────────────────


class NewsArticleUpdate(BaseModel):
    is_dismissed: bool | None = None
    dismissed_reason: str | None = None
    is_reviewed: bool | None = None


class NewsScanStatus(BaseModel):
    last_scan_at: datetime | None = None
    next_scan_at: datetime | None = None
    is_scanning: bool = False
    articles_found_last_scan: int = 0


class BulkActionRequest(BaseModel):
    article_ids: list[uuid.UUID]
    action: str  # "dismiss", "file_foia", "mark_reviewed"


class FileFoiaFromArticle(BaseModel):
    agency_id: uuid.UUID | None = None


# ── Scan / FOIA filing responses ─────────────────────────────────────────


class ScanNowResponse(BaseModel):
    found: int
    new: int
    duplicate: int
    errors: int
    classified: int


class FileFoiaResponse(BaseModel):
    foia_request_id: uuid.UUID
    case_number: str
    agency_name: str
    status: str
    request_text: str
    created_at: datetime


class BulkActionResponse(BaseModel):
    affected: int
    action: str
    details: str | None = None
