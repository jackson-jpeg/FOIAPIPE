"""Agency contact model – track multiple contacts per agency."""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.agency import Agency


class ContactType(str, Enum):
    """Type of agency contact."""

    records_custodian = "records_custodian"
    media_liaison = "media_liaison"
    public_information_officer = "public_information_officer"
    legal_counsel = "legal_counsel"
    chief = "chief"
    sheriff = "sheriff"
    captain = "captain"
    sergeant = "sergeant"
    administrative = "administrative"
    other = "other"


class AgencyContact(Base):
    """Individual contact within an agency.

    Allows tracking multiple points of contact per agency with different roles.
    """

    __tablename__ = "agency_contacts"

    agency_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_type: Mapped[ContactType] = mapped_column(
        String(50), default=ContactType.other, nullable=False
    )
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    office_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────
    agency: Mapped[Agency] = relationship("Agency", back_populates="contacts")

    def __repr__(self) -> str:
        return f"<AgencyContact {self.name} ({self.contact_type.value})>"
