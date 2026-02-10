"""Audit logging service for tracking sensitive operations."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog

logger = logging.getLogger(__name__)


async def log_audit_event(
    db: AsyncSession,
    action: AuditAction,
    user: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
    success: bool = True,
    error_message: Optional[str] = None,
) -> AuditLog:
    """Create an audit log entry.

    Args:
        db: Database session
        action: Type of action performed
        user: Username or identifier
        resource_type: Type of resource affected (e.g., "foia", "agency")
        resource_id: ID of the affected resource
        details: Additional context as JSON
        request: FastAPI request object (to extract IP and user agent)
        success: Whether the operation succeeded
        error_message: Error message if operation failed

    Returns:
        Created AuditLog instance
    """
    # Extract request metadata if available
    ip_address = None
    user_agent = None

    if request:
        # Get real IP (handle proxy headers)
        ip_address = request.headers.get("X-Forwarded-For")
        if ip_address:
            # Take first IP if multiple (comma-separated)
            ip_address = ip_address.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None

        user_agent = request.headers.get("User-Agent")

    # Create audit log entry
    audit_entry = AuditLog(
        action=action,
        user=user,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
        error_message=error_message,
    )

    db.add(audit_entry)

    # Flush but don't commit (let caller control transaction)
    try:
        await db.flush()
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
        # Don't fail the main operation if audit logging fails
        pass

    return audit_entry


def create_audit_details(
    operation: str,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    **kwargs,
) -> dict[str, Any]:
    """Helper to create structured audit details.

    Args:
        operation: Description of operation
        before: State before change
        after: State after change
        **kwargs: Additional context

    Returns:
        Structured details dictionary
    """
    details = {"operation": operation}

    if before is not None:
        details["before"] = before

    if after is not None:
        details["after"] = after

    # Add any additional context
    details.update(kwargs)

    return details
