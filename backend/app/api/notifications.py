"""Notification endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationList

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    notification_type: str | None = Query(None, description="Filter by type category: foia, video, revenue, system"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    stmt = select(Notification)
    count_stmt = select(func.count(Notification.id))
    unread_stmt = select(func.count(Notification.id)).where(
        Notification.is_read.is_(False)
    )

    # Type category filter
    _TYPE_CATEGORIES = {
        "foia": ["foia_submitted", "foia_acknowledged", "foia_fulfilled", "foia_denied", "foia_overdue"],
        "video": ["video_uploaded", "video_published"],
        "revenue": ["revenue_milestone"],
        "system": ["scan_complete", "system_error"],
    }

    if notification_type and notification_type in _TYPE_CATEGORIES:
        type_values = _TYPE_CATEGORIES[notification_type]
        stmt = stmt.where(Notification.type.in_(type_values))
        count_stmt = count_stmt.where(Notification.type.in_(type_values))

    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
        count_stmt = count_stmt.where(Notification.is_read.is_(False))

    total = (await db.execute(count_stmt)).scalar() or 0
    unread_count = (await db.execute(unread_stmt)).scalar() or 0

    stmt = (
        stmt.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(stmt)).scalars().all()

    return NotificationList(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.post("/mark-all-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}
