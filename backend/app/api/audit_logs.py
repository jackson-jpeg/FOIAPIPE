"""Audit logs router – query and export audit trail."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.audit_log import AuditAction, AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    action: AuditAction | None = Query(None, description="Filter by action type"),
    user: str | None = Query(None, description="Filter by user"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    resource_id: str | None = Query(None, description="Filter by resource ID"),
    date_from: datetime | None = Query(None, description="Filter from date"),
    date_to: datetime | None = Query(None, description="Filter to date"),
    success_only: bool | None = Query(None, description="Show only successful operations"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """List audit logs with filtering and pagination.

    Returns audit trail for compliance and security monitoring.
    """
    # Build query
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    count_stmt = select(func.count(AuditLog.id))

    # Apply filters
    filters = []

    if action:
        filters.append(AuditLog.action == action)

    if user:
        filters.append(AuditLog.user.ilike(f"%{user}%"))

    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)

    if resource_id:
        filters.append(AuditLog.resource_id == resource_id)

    if date_from:
        filters.append(AuditLog.created_at >= date_from)

    if date_to:
        filters.append(AuditLog.created_at <= date_to)

    if success_only is not None:
        filters.append(AuditLog.success == success_only)

    if filters:
        stmt = stmt.where(and_(*filters))
        count_stmt = count_stmt.where(and_(*filters))

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    # Execute queries
    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "action": log.action.value,
                "user": log.user,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "success": log.success,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/summary")
async def audit_summary(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get summary statistics of audit logs.

    Returns:
        - Total events
        - Events by action type
        - Events by user
        - Success/failure rates
        - Recent activity trends
    """
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Total events
    total_events = (
        await db.execute(
            select(func.count(AuditLog.id)).where(AuditLog.created_at >= start_date)
        )
    ).scalar() or 0

    # Events by action
    action_counts_result = await db.execute(
        select(AuditLog.action, func.count(AuditLog.id).label("count"))
        .where(AuditLog.created_at >= start_date)
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )
    action_counts = {
        row.action.value: row.count for row in action_counts_result.all()
    }

    # Events by user
    user_counts_result = await db.execute(
        select(AuditLog.user, func.count(AuditLog.id).label("count"))
        .where(AuditLog.created_at >= start_date)
        .group_by(AuditLog.user)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )
    user_counts = {row.user: row.count for row in user_counts_result.all()}

    # Success/failure stats
    success_count = (
        await db.execute(
            select(func.count(AuditLog.id)).where(
                and_(
                    AuditLog.created_at >= start_date,
                    AuditLog.success == True,
                )
            )
        )
    ).scalar() or 0

    failure_count = (
        await db.execute(
            select(func.count(AuditLog.id)).where(
                and_(
                    AuditLog.created_at >= start_date,
                    AuditLog.success == False,
                )
            )
        )
    ).scalar() or 0

    # Recent failed operations
    recent_failures_result = await db.execute(
        select(AuditLog)
        .where(
            and_(
                AuditLog.created_at >= start_date,
                AuditLog.success == False,
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    )
    recent_failures = [
        {
            "action": log.action.value,
            "user": log.user,
            "error_message": log.error_message,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in recent_failures_result.scalars().all()
    ]

    return {
        "period_days": days,
        "total_events": total_events,
        "success_count": success_count,
        "failure_count": failure_count,
        "success_rate": (
            round((success_count / max(total_events, 1)) * 100, 2)
        ),
        "top_actions": action_counts,
        "top_users": user_counts,
        "recent_failures": recent_failures,
    }


@router.get("/security-events")
async def security_events(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get security-relevant events.

    Returns login attempts, failed operations, and suspicious activity.
    """
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Login attempts
    login_attempts = await db.execute(
        select(AuditLog)
        .where(
            and_(
                AuditLog.created_at >= start_date,
                or_(
                    AuditLog.action == AuditAction.login_success,
                    AuditLog.action == AuditAction.login_failed,
                ),
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )

    login_events = [
        {
            "action": log.action.value,
            "user": log.user,
            "ip_address": log.ip_address,
            "success": log.success,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in login_attempts.scalars().all()
    ]

    # Failed login count by IP
    failed_logins_by_ip = await db.execute(
        select(AuditLog.ip_address, func.count(AuditLog.id).label("count"))
        .where(
            and_(
                AuditLog.created_at >= start_date,
                AuditLog.action == AuditAction.login_failed,
            )
        )
        .group_by(AuditLog.ip_address)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )

    suspicious_ips = {
        row.ip_address: row.count
        for row in failed_logins_by_ip.all()
        if row.count >= 3  # 3+ failed attempts
    }

    # Sensitive operations (deletions, config changes)
    sensitive_ops = await db.execute(
        select(AuditLog)
        .where(
            and_(
                AuditLog.created_at >= start_date,
                or_(
                    AuditLog.action.in_([
                        AuditAction.foia_deleted,
                        AuditAction.agency_deleted,
                        AuditAction.video_deleted,
                        AuditAction.setting_updated,
                        AuditAction.backup_restored,
                    ])
                ),
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )

    sensitive_events = [
        {
            "action": log.action.value,
            "user": log.user,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in sensitive_ops.scalars().all()
    ]

    return {
        "period_days": days,
        "login_events": login_events,
        "suspicious_ips": suspicious_ips,
        "sensitive_operations": sensitive_events,
        "total_failed_logins": sum(suspicious_ips.values()),
    }
