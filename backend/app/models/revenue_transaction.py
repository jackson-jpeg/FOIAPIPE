"""RevenueTransaction model – income and expenses tied to operations."""

from __future__ import annotations

import enum
import uuid as _uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TransactionType(str, enum.Enum):
    youtube_adsense = "youtube_adsense"
    sponsorship = "sponsorship"
    licensing = "licensing"
    foia_cost = "foia_cost"
    editing_cost = "editing_cost"
    equipment = "equipment"
    other_income = "other_income"
    other_expense = "other_expense"


class RevenueTransaction(Base):
    __tablename__ = "revenue_transactions"

    video_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="SET NULL"),
        nullable=True,
    )
    foia_request_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("foia_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transaction_type_enum"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_income: Mapped[bool] = mapped_column(Boolean, nullable=False)

    def __repr__(self) -> str:
        return f"<RevenueTransaction {self.transaction_type.value} {self.amount}>"
