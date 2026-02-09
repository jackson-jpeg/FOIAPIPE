"""Pydantic schemas for notification endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationChannel, NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: NotificationType
    channel: NotificationChannel
    title: str
    message: str
    is_read: bool
    link: str | None = None
    sent_at: datetime | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class NotificationList(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int


class NotificationPreference(BaseModel):
    event_type: str
    email_enabled: bool = True
    sms_enabled: bool = False
    in_app_enabled: bool = True


class NotificationPreferencesUpdate(BaseModel):
    preferences: list[NotificationPreference]
