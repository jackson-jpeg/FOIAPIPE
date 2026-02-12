"""Agency model – law enforcement agencies that receive FOIA requests."""

from __future__ import annotations

from typing import TYPE_CHECKING

from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.foia_request import FoiaRequest
    from app.models.agency_contact import AgencyContact


class Agency(Base):
    __tablename__ = "agencies"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    abbreviation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    foia_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    foia_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    foia_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    state: Mapped[str] = mapped_column(String(2), default="FL", nullable=False)
    jurisdiction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avg_response_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # FOIA customization
    foia_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    typical_cost_per_hour: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=10, scale=2), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────
    foia_requests: Mapped[list[FoiaRequest]] = relationship(
        "FoiaRequest",
        back_populates="agency",
        lazy="select",
    )

    contacts: Mapped[list[AgencyContact]] = relationship(
        "AgencyContact",
        back_populates="agency",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Agency {self.abbreviation or self.name}>"
