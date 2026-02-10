"""Circuit breaker service for news source reliability tracking."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_source_health import NewsSourceHealth

logger = logging.getLogger(__name__)

# Circuit breaker configuration
FAILURE_THRESHOLD = 3  # Open circuit after N consecutive failures
CIRCUIT_RETRY_DELAY_HOURS = 6  # Retry after 6 hours when circuit is open


async def get_or_create_source_health(
    db: AsyncSession, source_name: str, source_url: str
) -> NewsSourceHealth:
    """Get or create a NewsSourceHealth record for a source."""
    result = await db.execute(
        select(NewsSourceHealth).where(NewsSourceHealth.source_name == source_name).limit(1)
    )
    health = result.scalar_one_or_none()

    if not health:
        health = NewsSourceHealth(
            source_name=source_name,
            source_url=source_url,
            is_enabled=True,
            is_circuit_open=False,
            consecutive_failures=0,
            total_failures=0,
            total_successes=0,
        )
        db.add(health)
        await db.flush()
        logger.info(f"Created health tracking for source: {source_name}")

    return health


async def should_skip_source(db: AsyncSession, source_name: str) -> tuple[bool, str]:
    """Check if a source should be skipped (disabled or circuit open).

    Returns:
        (should_skip, reason)
    """
    result = await db.execute(
        select(NewsSourceHealth).where(NewsSourceHealth.source_name == source_name).limit(1)
    )
    health = result.scalar_one_or_none()

    if not health:
        return False, "no_health_record"

    if not health.is_enabled:
        return True, "manually_disabled"

    if health.is_circuit_open:
        # Check if retry time has passed
        now = datetime.now(timezone.utc)
        if health.circuit_retry_after and now >= health.circuit_retry_after:
            # Time to retry - close the circuit temporarily
            logger.info(
                f"Circuit retry time reached for {source_name}, attempting to close circuit"
            )
            return False, "circuit_retry_attempt"
        else:
            retry_in = None
            if health.circuit_retry_after:
                retry_in = (health.circuit_retry_after - now).total_seconds() / 3600
            return True, f"circuit_open_retry_in_{retry_in:.1f}h"

    return False, "healthy"


async def record_success(db: AsyncSession, source_name: str, source_url: str) -> None:
    """Record a successful fetch from a news source."""
    health = await get_or_create_source_health(db, source_name, source_url)

    health.consecutive_failures = 0
    health.total_successes += 1
    health.last_success_at = datetime.now(timezone.utc)

    # Close circuit if it was open
    if health.is_circuit_open:
        health.is_circuit_open = False
        health.circuit_opened_at = None
        health.circuit_retry_after = None
        logger.info(f"✅ Circuit closed for {source_name} after successful fetch")

    await db.commit()


async def record_failure(
    db: AsyncSession, source_name: str, source_url: str, error_message: str
) -> None:
    """Record a failed fetch from a news source. Opens circuit if threshold exceeded."""
    health = await get_or_create_source_health(db, source_name, source_url)

    health.consecutive_failures += 1
    health.total_failures += 1
    health.last_failure_at = datetime.now(timezone.utc)
    health.last_error_message = error_message[:500]  # Truncate long errors

    # Open circuit if threshold exceeded
    if health.consecutive_failures >= FAILURE_THRESHOLD and not health.is_circuit_open:
        health.is_circuit_open = True
        health.circuit_opened_at = datetime.now(timezone.utc)
        health.circuit_retry_after = datetime.now(timezone.utc) + timedelta(
            hours=CIRCUIT_RETRY_DELAY_HOURS
        )

        logger.error(
            f"🔴 CIRCUIT OPENED for {source_name} after {health.consecutive_failures} "
            f"consecutive failures. Will retry at {health.circuit_retry_after.isoformat()}"
        )
        logger.error(f"Last error: {error_message}")
    else:
        logger.warning(
            f"⚠️  Source {source_name} failed ({health.consecutive_failures}/{FAILURE_THRESHOLD}): {error_message[:100]}"
        )

    await db.commit()


async def reset_circuit(db: AsyncSession, source_name: str) -> bool:
    """Manually reset a circuit breaker (admin action).

    Returns:
        True if circuit was reset, False if source not found
    """
    result = await db.execute(
        select(NewsSourceHealth).where(NewsSourceHealth.source_name == source_name).limit(1)
    )
    health = result.scalar_one_or_none()

    if not health:
        return False

    health.is_circuit_open = False
    health.consecutive_failures = 0
    health.circuit_opened_at = None
    health.circuit_retry_after = None
    health.last_error_message = None

    await db.commit()
    logger.info(f"Circuit manually reset for {source_name}")
    return True


async def get_all_source_health(db: AsyncSession) -> list[NewsSourceHealth]:
    """Get health status for all tracked news sources."""
    result = await db.execute(select(NewsSourceHealth).order_by(NewsSourceHealth.source_name))
    return list(result.scalars().all())


async def get_source_health_summary(db: AsyncSession) -> dict:
    """Get summary statistics for all news sources."""
    all_health = await get_all_source_health(db)

    return {
        "total_sources": len(all_health),
        "enabled_sources": sum(1 for h in all_health if h.is_enabled),
        "circuits_open": sum(1 for h in all_health if h.is_circuit_open),
        "healthy_sources": sum(
            1 for h in all_health if h.is_enabled and not h.is_circuit_open
        ),
        "total_failures_all_time": sum(h.total_failures for h in all_health),
        "total_successes_all_time": sum(h.total_successes for h in all_health),
    }
