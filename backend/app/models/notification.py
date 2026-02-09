"""Notification model – in-app, email, and SMS notifications."""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotificationType(str, enum.Enum):
    foia_submitted = "foia_submitted"
    foia_acknowledged = "foia_acknowledged"
    foia_fulfilled = "foia_fulfilled"
    foia_denied = "foia_denied"
    foia_overdue = "foia_overdue"
    scan_complete = "scan_complete"
    video_uploaded = "video_uploaded"
    video_published = "video_published"
    revenue_milestone = "revenue_milestone"
    system_error = "system_error"


class NotificationChannel(str, enum.Enum):
    email = "email"
    sms = "sms"
    in_app = "in_app"


class Notification(Base):
    __tablename__ = "notifications"

    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type_enum"), nullable=False
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel_enum"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Notification {self.type.value} via {self.channel.value}>"
