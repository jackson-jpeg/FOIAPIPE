"""FoiaRequest model – public records requests sent to agencies."""

from __future__ import annotations

import enum
import uuid as _uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.agency import Agency
    from app.models.foia_status_change import FoiaStatusChange
    from app.models.news_article import NewsArticle
    from app.models.video import Video


class FoiaStatus(str, enum.Enum):
    draft = "draft"
    ready = "ready"
    submitted = "submitted"
    acknowledged = "acknowledged"
    processing = "processing"
    fulfilled = "fulfilled"
    partial = "partial"
    denied = "denied"
    appealed = "appealed"
    closed = "closed"


class FoiaPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class FoiaRequest(Base):
    __tablename__ = "foia_requests"

    case_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False
    )
    agency_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="RESTRICT"),
        nullable=False,
    )
    news_article_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("news_articles.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[FoiaStatus] = mapped_column(
        Enum(FoiaStatus, name="foia_status_enum"),
        default=FoiaStatus.draft,
        nullable=False,
        index=True,
    )
    priority: Mapped[FoiaPriority] = mapped_column(
        Enum(FoiaPriority, name="foia_priority_enum"),
        default=FoiaPriority.medium,
        nullable=False,
    )
    request_text: Mapped[str] = mapped_column(Text, nullable=False)
    pdf_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    fulfilled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    agency_reference_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    estimated_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    actual_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    payment_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    response_emails: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_auto_submitted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────
    agency: Mapped[Agency] = relationship(
        "Agency",
        back_populates="foia_requests",
        lazy="selectin",
    )
    news_article: Mapped[NewsArticle | None] = relationship(
        "NewsArticle",
        back_populates="foia_requests",
        lazy="selectin",
    )
    videos: Mapped[list[Video]] = relationship(
        "Video",
        back_populates="foia_request",
        lazy="selectin",
    )
    status_changes: Mapped[list[FoiaStatusChange]] = relationship(
        "FoiaStatusChange",
        back_populates="foia_request",
        lazy="selectin",
        order_by="FoiaStatusChange.created_at",
    )

    def __repr__(self) -> str:
        return f"<FoiaRequest {self.case_number}>"
