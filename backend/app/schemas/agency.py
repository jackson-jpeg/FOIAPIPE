"""Pydantic schemas for agency endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from decimal import Decimal

from pydantic import BaseModel


# ── Create / Update ──────────────────────────────────────────────────────


class AgencyCreate(BaseModel):
    name: str
    abbreviation: str | None = None
    foia_email: str | None = None
    foia_phone: str | None = None
    foia_address: str | None = None
    website: str | None = None
    state: str = "FL"
    jurisdiction: str | None = None
    notes: str | None = None
    foia_template: str | None = None
    typical_cost_per_hour: Decimal | None = None


class AgencyUpdate(BaseModel):
    name: str | None = None
    abbreviation: str | None = None
    foia_email: str | None = None
    foia_phone: str | None = None
    foia_address: str | None = None
    website: str | None = None
    state: str | None = None
    jurisdiction: str | None = None
    is_active: bool | None = None
    avg_response_days: int | None = None
    notes: str | None = None
    foia_template: str | None = None
    typical_cost_per_hour: Decimal | None = None


# ── Responses ─────────────────────────────────────────────────────────────


class AgencyResponse(BaseModel):
    id: uuid.UUID
    name: str
    abbreviation: str | None = None
    foia_email: str | None = None
    foia_phone: str | None = None
    foia_address: str | None = None
    website: str | None = None
    state: str
    jurisdiction: str | None = None
    is_active: bool
    avg_response_days: int | None = None
    notes: str | None = None
    foia_template: str | None = None
    typical_cost_per_hour: Decimal | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AgencyList(BaseModel):
    items: list[AgencyResponse]
    total: int


class AgencyStats(BaseModel):
    total_requests: int = 0
    requests_by_status: dict[str, int] = {}
    fulfillment_rate: float = 0.0
    avg_cost: float | None = None
    total_cost: float | None = None
    avg_response_days_actual: float | None = None


class AgencyRecentFoia(BaseModel):
    id: uuid.UUID
    case_number: str
    status: str
    priority: str
    submitted_at: datetime | None = None
    created_at: datetime
    request_text_preview: str

    model_config = {"from_attributes": True}
