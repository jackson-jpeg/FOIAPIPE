"""Pydantic schemas for agency contact endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.agency_contact import ContactType


# ── Create / Update ──────────────────────────────────────────────────────


class AgencyContactCreate(BaseModel):
    """Schema for creating a new agency contact."""

    name: str
    title: str | None = None
    contact_type: ContactType = ContactType.other
    email: EmailStr | None = None
    phone: str | None = None
    extension: str | None = None
    office_hours: str | None = None
    notes: str | None = None
    is_primary: bool = False
    is_active: bool = True


class AgencyContactUpdate(BaseModel):
    """Schema for updating an agency contact."""

    name: str | None = None
    title: str | None = None
    contact_type: ContactType | None = None
    email: EmailStr | None = None
    phone: str | None = None
    extension: str | None = None
    office_hours: str | None = None
    notes: str | None = None
    is_primary: bool | None = None
    is_active: bool | None = None


# ── Responses ─────────────────────────────────────────────────────────────


class AgencyContactResponse(BaseModel):
    """Schema for agency contact response."""

    id: uuid.UUID
    agency_id: uuid.UUID
    name: str
    title: str | None = None
    contact_type: str
    email: str | None = None
    phone: str | None = None
    extension: str | None = None
    office_hours: str | None = None
    notes: str | None = None
    is_primary: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AgencyContactList(BaseModel):
    """Schema for list of agency contacts."""

    items: list[AgencyContactResponse]
    total: int
