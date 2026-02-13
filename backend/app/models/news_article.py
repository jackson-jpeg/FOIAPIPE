"""NewsArticle model – articles scraped from RSS feeds and websites."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Enum, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.foia_request import FoiaRequest


class IncidentType(str, enum.Enum):
    ois = "ois"
    use_of_force = "use_of_force"
    pursuit = "pursuit"
    taser = "taser"
    k9 = "k9"
    arrest = "arrest"
    dui = "dui"
    other = "other"


class NewsArticle(Base):
    __tablename__ = "news_articles"

    url: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    headline: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    incident_type: Mapped[IncidentType | None] = mapped_column(
        Enum(IncidentType, name="incident_type_enum"), nullable=True
    )
    severity_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    virality_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    detected_agency: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detected_officers: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    detected_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dismissed_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    auto_foia_eligible: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    auto_foia_filed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    predicted_revenue: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    priority_factors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────
    foia_requests: Mapped[list[FoiaRequest]] = relationship(
        "FoiaRequest",
        back_populates="news_article",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<NewsArticle {self.headline[:50]}>"
