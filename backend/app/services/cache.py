"""Redis caching layer, distributed locking, and SSE pub/sub.

Provides:
- cache_get / cache_set / cache_delete / cache_delete_pattern for app-level caching
- distributed_lock context manager for critical sections
- publish_sse / subscribe_sse for cross-process SSE event delivery
"""

import json
import uuid
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

_redis: aioredis.Redis | None = None


class LockError(Exception):
    """Raised when a distributed lock cannot be acquired."""


async def get_redis() -> aioredis.Redis:
    """Return a shared async Redis connection (lazy-initialized)."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def close_redis() -> None:
    """Close the shared Redis connection (for graceful shutdown)."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


# ── Caching ──────────────────────────────────────────────────────────────


async def cache_get(key: str) -> Any | None:
    """Get a cached value by key. Returns None on miss or error."""
    try:
        r = await get_redis()
        val = await r.get(f"cache:{key}")
        return json.loads(val) if val else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Set a cache value with TTL in seconds."""
    try:
        r = await get_redis()
        await r.set(f"cache:{key}", json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Delete a specific cache key."""
    try:
        r = await get_redis()
        await r.delete(f"cache:{key}")
    except Exception:
        pass


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all cache keys matching a glob pattern."""
    try:
        r = await get_redis()
        async for key in r.scan_iter(f"cache:{pattern}"):
            await r.delete(key)
    except Exception:
        pass


# ── Distributed Locking ──────────────────────────────────────────────────


@asynccontextmanager
async def distributed_lock(name: str, timeout: int = 30):
    """Acquire a Redis-based distributed lock using SET NX EX.

    Raises LockError if the lock is already held.
    Uses a unique token + Lua script for safe release (only the owner can unlock).
    """
    r = await get_redis()
    lock_key = f"lock:{name}"
    token = str(uuid.uuid4())
    acquired = await r.set(lock_key, token, nx=True, ex=timeout)
    if not acquired:
        raise LockError(f"Could not acquire lock: {name}")
    try:
        yield
    finally:
        # Only delete if we still own the lock (compare token via Lua)
        lua = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
        await r.eval(lua, 1, lock_key, token)


# ── SSE Pub/Sub ──────────────────────────────────────────────────────────

SSE_CHANNEL = "sse:events"


async def publish_sse(event_type: str, data: dict) -> None:
    """Publish an SSE event to Redis pub/sub (works from any process)."""
    try:
        r = await get_redis()
        message = json.dumps({"type": event_type, **data}, default=str)
        await r.publish(SSE_CHANNEL, message)
    except Exception:
        pass
