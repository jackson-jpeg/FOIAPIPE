"""Audit log model – immutable records of sensitive operations."""

from __future__ import annotations

from enum import Enum

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditAction(str, Enum):
    """Types of audited actions."""

    # Authentication
    login_success = "login_success"
    login_failed = "login_failed"
    logout = "logout"

    # FOIA operations
    foia_created = "foia_created"
    foia_submitted = "foia_submitted"
    foia_status_changed = "foia_status_changed"
    foia_deleted = "foia_deleted"
    foia_batch_submitted = "foia_batch_submitted"
    foia_appeal_generated = "foia_appeal_generated"
    foia_auto_submit_decision = "foia_auto_submit_decision"

    # Agency operations
    agency_created = "agency_created"
    agency_updated = "agency_updated"
    agency_deleted = "agency_deleted"
    agency_contact_created = "agency_contact_created"
    agency_contact_updated = "agency_contact_updated"
    agency_contact_deleted = "agency_contact_deleted"
    agency_template_updated = "agency_template_updated"

    # Configuration changes
    setting_updated = "setting_updated"
    template_updated = "template_updated"

    # Data operations
    data_exported = "data_exported"
    backup_created = "backup_created"
    backup_restored = "backup_restored"

    # Video operations
    video_created = "video_created"
    video_published = "video_published"
    video_deleted = "video_deleted"

    # System operations
    circuit_breaker_opened = "circuit_breaker_opened"
    circuit_breaker_reset = "circuit_breaker_reset"
    system_maintenance = "system_maintenance"


class AuditLog(Base):
    """Immutable audit log for compliance and security tracking.

    Records who did what, when, and with what result.
    """

    __tablename__ = "audit_logs"

    action: Mapped[AuditAction] = mapped_column(String(100), nullable=False, index=True)
    user: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    success: Mapped[bool] = mapped_column(default=True, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog {self.action.value} by {self.user} at {self.created_at}>"
