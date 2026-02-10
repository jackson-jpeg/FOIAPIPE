"""API endpoints for viewing and managing news source circuit breakers."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.services.circuit_breaker import (
    get_all_source_health,
    get_source_health_summary,
    reset_circuit,
)

router = APIRouter(prefix="/api/circuit-breakers", tags=["circuit-breakers"])


@router.get("/summary")
async def get_circuit_breaker_summary(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Get summary statistics for all news source circuit breakers."""
    return await get_source_health_summary(db)


@router.get("/")
async def list_circuit_breakers(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """List all news source health records with circuit breaker status."""
    health_records = await get_all_source_health(db)

    return {
        "items": [
            {
                "id": str(h.id),
                "source_name": h.source_name,
                "source_url": h.source_url,
                "is_enabled": h.is_enabled,
                "is_circuit_open": h.is_circuit_open,
                "consecutive_failures": h.consecutive_failures,
                "total_failures": h.total_failures,
                "total_successes": h.total_successes,
                "last_success_at": h.last_success_at.isoformat() if h.last_success_at else None,
                "last_failure_at": h.last_failure_at.isoformat() if h.last_failure_at else None,
                "circuit_opened_at": h.circuit_opened_at.isoformat() if h.circuit_opened_at else None,
                "circuit_retry_after": h.circuit_retry_after.isoformat() if h.circuit_retry_after else None,
                "last_error_message": h.last_error_message,
                "created_at": h.created_at.isoformat(),
            }
            for h in health_records
        ],
        "total": len(health_records),
    }


@router.post("/{source_name}/reset")
async def reset_circuit_breaker(
    source_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Manually reset a circuit breaker for a news source."""
    success = await reset_circuit(db, source_name)

    if not success:
        raise HTTPException(status_code=404, detail=f"Source '{source_name}' not found")

    return {
        "success": True,
        "message": f"Circuit breaker reset for {source_name}",
        "source_name": source_name,
    }
