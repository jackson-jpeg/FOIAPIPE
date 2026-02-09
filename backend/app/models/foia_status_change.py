"""FoiaStatusChange model – audit trail for FOIA status transitions."""

from __future__ import annotations

import uuid as _uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.foia_request import FoiaRequest


class FoiaStatusChange(Base):
    """Audit trail for FOIA request status changes (legal compliance)."""

    __tablename__ = "foia_status_changes"

    foia_request_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("foia_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[str] = mapped_column(String(50), nullable=False)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "admin", "system", "email_monitor"
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[Any | None] = mapped_column(
        JSON, nullable=True
    )  # Store email content, API responses, etc.

    # ── Relationships ─────────────────────────────────────────────────────
    foia_request: Mapped[FoiaRequest] = relationship(
        "FoiaRequest",
        back_populates="status_changes",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<FoiaStatusChange {self.from_status} → {self.to_status} by {self.changed_by}>"
