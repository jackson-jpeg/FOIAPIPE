"""App settings endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.app_setting import AppSetting
from app.schemas.settings import AppSettingResponse, AppSettingUpdate
from app.services.cache import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "scan_interval_minutes": {
        "value": "30",
        "value_type": "integer",
        "description": "Minutes between RSS scans",
    },
    "auto_submit_enabled": {
        "value": "false",
        "value_type": "boolean",
        "description": "Auto-submit FOIAs for eligible articles",
    },
    "auto_submit_threshold": {
        "value": "7",
        "value_type": "integer",
        "description": "Minimum severity score for auto-submit",
    },
    "max_auto_submits_per_day": {
        "value": "5",
        "value_type": "integer",
        "description": "Maximum auto-submissions per day",
    },
    "auto_submit_mode": {
        "value": "off",
        "value_type": "string",
        "description": "Auto-submit mode: off, dry_run, or live",
    },
    "max_auto_submits_per_agency_per_week": {
        "value": "3",
        "value_type": "integer",
        "description": "Maximum auto-submissions per agency per 7 days",
    },
    "auto_submit_cost_cap": {
        "value": "50.00",
        "value_type": "float",
        "description": "Skip auto-filing if predicted cost exceeds this amount",
    },
    "notification_email_enabled": {
        "value": "true",
        "value_type": "boolean",
        "description": "Send email notifications",
    },
    "notification_sms_enabled": {
        "value": "false",
        "value_type": "boolean",
        "description": "Send SMS notifications",
    },
}


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    cached = await cache_get("settings:all")
    if cached is not None:
        return cached

    result = await db.execute(select(AppSetting))
    settings = {
        s.key: AppSettingResponse.model_validate(s) for s in result.scalars().all()
    }

    # Fill in defaults for missing settings
    for key, defaults in DEFAULT_SETTINGS.items():
        if key not in settings:
            settings[key] = AppSettingResponse(
                key=key,
                value=defaults["value"],
                value_type=defaults["value_type"],
                description=defaults["description"],
            )

    response = {"settings": [s.model_dump(mode="json") for s in settings.values()]}
    await cache_set("settings:all", response, ttl=300)
    return response


@router.put("")
async def update_settings(
    updates: list[AppSettingUpdate],
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    for upd in updates:
        result = await db.execute(
            select(AppSetting).where(AppSetting.key == upd.key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = upd.value
        else:
            defaults = DEFAULT_SETTINGS.get(upd.key, {})
            setting = AppSetting(
                key=upd.key,
                value=upd.value,
                value_type=defaults.get("value_type", "string"),
                description=defaults.get("description"),
            )
            db.add(setting)

    await db.commit()
    await cache_delete("settings:all")
    return {"ok": True}
