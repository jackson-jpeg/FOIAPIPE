"""Redis caching layer, distributed locking, and SSE pub/sub.

Provides:
- cache_get / cache_set / cache_delete / cache_delete_pattern for app-level caching
- distributed_lock context manager for critical sections
- publish_sse / subscribe_sse for cross-process SSE event delivery
"""

import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from redis.exceptions import RedisError, ConnectionError, TimeoutError

from app.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


class LockError(Exception):
    """Raised when a distributed lock cannot be acquired."""


async def get_redis() -> aioredis.Redis | None:
    """Return a shared async Redis connection (lazy-initialized). Returns None if connection fails."""
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            # Test connection
            await _redis.ping()
        except (ConnectionError, TimeoutError) as e:
            logger.error(f"Failed to connect to Redis: {e}")
            _redis = None
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis: {e}")
            _redis = None
    return _redis


async def close_redis() -> None:
    """Close the shared Redis connection (for graceful shutdown)."""
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception as e:
            logger.warning(f"Error closing Redis connection: {e}")
        finally:
            _redis = None


# ── Caching ──────────────────────────────────────────────────────────────


async def cache_get(key: str) -> Any | None:
    """Get a cached value by key. Returns None on miss or error."""
    try:
        r = await get_redis()
        if r is None:
            return None
        val = await r.get(f"cache:{key}")
        return json.loads(val) if val else None
    except (RedisError, ConnectionError, TimeoutError) as e:
        logger.warning(f"Redis cache_get error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in cache_get: {e}")
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Set a cache value with TTL in seconds."""
    try:
        r = await get_redis()
        if r is None:
            return
        await r.set(f"cache:{key}", json.dumps(value, default=str), ex=ttl)
    except (RedisError, ConnectionError, TimeoutError) as e:
        logger.warning(f"Redis cache_set error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in cache_set: {e}")


async def cache_delete(key: str) -> None:
    """Delete a specific cache key."""
    try:
        r = await get_redis()
        if r is None:
            return
        await r.delete(f"cache:{key}")
    except (RedisError, ConnectionError, TimeoutError) as e:
        logger.warning(f"Redis cache_delete error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in cache_delete: {e}")


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all cache keys matching a glob pattern."""
    try:
        r = await get_redis()
        if r is None:
            return
        async for key in r.scan_iter(f"cache:{pattern}"):
            await r.delete(key)
    except (RedisError, ConnectionError, TimeoutError) as e:
        logger.warning(f"Redis cache_delete_pattern error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in cache_delete_pattern: {e}")


# ── Distributed Locking ──────────────────────────────────────────────────


@asynccontextmanager
async def distributed_lock(name: str, timeout: int = 30):
    """Acquire a Redis-based distributed lock using SET NX EX.

    Raises LockError if the lock is already held.
    Uses a unique token + Lua script for safe release (only the owner can unlock).
    """
    r = await get_redis()
    if r is None:
        logger.warning("Redis unavailable, skipping distributed lock")
        yield
        return
        
    lock_key = f"lock:{name}"
    token = str(uuid.uuid4())
    try:
        acquired = await r.set(lock_key, token, nx=True, ex=timeout)
        if not acquired:
            raise LockError(f"Could not acquire lock: {name}")
        try:
            yield
        finally:
            # Only delete if we still own the lock (compare token via Lua)
            lua = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
            try:
                await r.eval(lua, 1, lock_key, token)
            except Exception as e:
                logger.warning(f"Error releasing distributed lock: {e}")
    except (RedisError, ConnectionError, TimeoutError) as e:
        logger.warning(f"Redis distributed_lock error: {e}")
        yield  # Graceful degradation - proceed without lock


# ── SSE Pub/Sub ──────────────────────────────────────────────────────────

SSE_CHANNEL = "sse:events"


async def publish_sse(event_type: str, data: dict) -> None:
    """Publish an SSE event to Redis pub/sub (works from any process)."""
    try:
        r = await get_redis()
        if r is None:
            return
        message = json.dumps({"type": event_type, **data}, default=str)
        await r.publish(SSE_CHANNEL, message)
    except (RedisError, ConnectionError, TimeoutError) as e:
        logger.warning(f"Redis publish_sse error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in publish_sse: {e}")
