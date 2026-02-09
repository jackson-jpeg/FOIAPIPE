"""Pydantic schemas for analytics and revenue endpoints."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.revenue_transaction import TransactionType


# ── Overview & Time Series ────────────────────────────────────────────────


class AnalyticsOverview(BaseModel):
    total_views: int = 0
    total_revenue: Decimal = Decimal("0.00")
    total_subscribers: int = 0
    avg_rpm: Decimal = Decimal("0.00")
    period_views: int = 0
    period_revenue: Decimal = Decimal("0.00")


class DailyMetric(BaseModel):
    date: date
    value: float


class RevenueTimeSeries(BaseModel):
    data: list[DailyMetric]


class ViewsTimeSeries(BaseModel):
    data: list[DailyMetric]


# ── Top Content & Performance ─────────────────────────────────────────────


class TopVideo(BaseModel):
    id: uuid.UUID
    title: str | None = None
    thumbnail_url: str | None = None
    views: int = 0
    revenue: Decimal = Decimal("0.00")
    rpm: Decimal = Decimal("0.00")
    ctr: float = 0.0
    published_at: datetime | None = None


class AgencyPerformance(BaseModel):
    agency_name: str
    video_count: int = 0
    total_views: int = 0
    total_revenue: Decimal = Decimal("0.00")


class IncidentTypePerformance(BaseModel):
    incident_type: str
    video_count: int = 0
    total_views: int = 0
    total_revenue: Decimal = Decimal("0.00")


# ── Pipeline ──────────────────────────────────────────────────────────────


class FunnelStep(BaseModel):
    label: str
    count: int
    conversion_rate: float | None = None


class PipelineFunnel(BaseModel):
    steps: list[FunnelStep]


class PipelineVelocity(BaseModel):
    stage: str
    avg_days: float


# ── Revenue Transactions ─────────────────────────────────────────────────


class RevenueTransactionResponse(BaseModel):
    id: uuid.UUID
    video_id: uuid.UUID | None = None
    foia_request_id: uuid.UUID | None = None
    transaction_type: TransactionType
    amount: Decimal
    description: str | None = None
    transaction_date: date
    is_income: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class RevenueTransactionCreate(BaseModel):
    transaction_type: TransactionType
    amount: Decimal
    description: str | None = None
    transaction_date: date
    video_id: uuid.UUID | None = None
    foia_request_id: uuid.UUID | None = None
    is_income: bool


class RevenueSummary(BaseModel):
    gross_income: Decimal = Decimal("0.00")
    total_expenses: Decimal = Decimal("0.00")
    net_profit: Decimal = Decimal("0.00")
    foia_costs: Decimal = Decimal("0.00")
    editing_costs: Decimal = Decimal("0.00")
    per_video_avg: Decimal = Decimal("0.00")
