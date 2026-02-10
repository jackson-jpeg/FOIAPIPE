#!/usr/bin/env python3
"""Test circuit breaker functionality."""

import asyncio
import sys
from datetime import datetime

sys.path.insert(0, "/Users/jackson/FOIAPIPE/backend")

from app.database import async_session_factory
from app.services.circuit_breaker import (
    get_or_create_source_health,
    record_failure,
    record_success,
    should_skip_source,
    get_source_health_summary,
)


async def test_circuit_breaker():
    """Test the circuit breaker flow."""
    print("="*80)
    print("CIRCUIT BREAKER TEST")
    print("="*80)

    async with async_session_factory() as db:
        test_source = "Test News Source"
        test_url = "https://test.example.com/feed"

        # Step 1: Create health record
        print("\n1. Creating health record...")
        health = await get_or_create_source_health(db, test_source, test_url)
        print(f"   Created: {health}")

        # Step 2: Test should_skip_source (should be False initially)
        print("\n2. Checking if source should be skipped...")
        should_skip, reason = await should_skip_source(db, test_source)
        print(f"   Should skip: {should_skip} (reason: {reason})")
        assert not should_skip, "Source should not be skipped initially"

        # Step 3: Record 3 consecutive failures
        print("\n3. Recording 3 consecutive failures...")
        for i in range(3):
            await record_failure(db, test_source, test_url, f"Test error {i+1}")
            print(f"   Failure {i+1} recorded")

        # Step 4: Check if circuit is now open
        print("\n4. Checking circuit status after failures...")
        should_skip, reason = await should_skip_source(db, test_source)
        print(f"   Should skip: {should_skip} (reason: {reason})")
        assert should_skip, "Circuit should be open after 3 failures"
        assert "circuit_open" in reason, f"Reason should mention circuit open, got: {reason}"

        # Step 5: Verify circuit opens and retry time is set
        health = await get_or_create_source_health(db, test_source, test_url)
        print(f"   Circuit open: {health.is_circuit_open}")
        print(f"   Consecutive failures: {health.consecutive_failures}")
        print(f"   Retry after: {health.circuit_retry_after}")
        assert health.is_circuit_open, "Circuit should be marked as open"
        assert health.circuit_retry_after is not None, "Retry time should be set"

        # Step 6: Record a success (should close circuit)
        print("\n5. Recording a success (should close circuit)...")
        await record_success(db, test_source, test_url)

        should_skip, reason = await should_skip_source(db, test_source)
        print(f"   Should skip: {should_skip} (reason: {reason})")
        assert not should_skip, "Circuit should be closed after success"

        health = await get_or_create_source_health(db, test_source, test_url)
        print(f"   Circuit open: {health.is_circuit_open}")
        print(f"   Consecutive failures: {health.consecutive_failures}")
        assert not health.is_circuit_open, "Circuit should be closed"
        assert health.consecutive_failures == 0, "Consecutive failures should be reset"

        # Step 7: Get summary
        print("\n6. Getting health summary...")
        summary = await get_source_health_summary(db)
        print(f"   Summary: {summary}")

    print("\n" + "="*80)
    print("✅ ALL TESTS PASSED")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(test_circuit_breaker())
