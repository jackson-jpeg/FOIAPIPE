"""Pydantic schemas for application settings endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AppSettingResponse(BaseModel):
    key: str
    value: str | None = None
    value_type: str = "string"
    description: str | None = None

    model_config = {"from_attributes": True}


class AppSettingUpdate(BaseModel):
    key: str
    value: str | None = None


class AllSettings(BaseModel):
    settings: list[AppSettingResponse]
