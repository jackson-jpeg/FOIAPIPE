"""Authentication router – login and JWT issuance."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models.audit_log import AuditAction
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.audit_logger import log_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

LOGIN_RATE_LIMIT = 5  # max attempts
LOGIN_RATE_WINDOW = 60  # per 60 seconds


async def _check_login_rate_limit(request: Request) -> None:
    """Inline rate limit for login (5 attempts/minute per IP).

    Uses Redis directly to avoid slowapi decorator breaking Pydantic body parsing.
    """
    try:
        from app.services.cache import get_redis
        client_ip = request.client.host if request.client else "unknown"
        key = f"foiaarchive:ratelimit:login:{client_ip}"
        r = await get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, LOGIN_RATE_WINDOW)
        if count > LOGIN_RATE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again in 1 minute.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Login rate limit check failed (allowing request): %s", e)


def _create_access_token(subject: str) -> str:
    """Create a signed JWT with an expiration claim."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Validate credentials and return an access token.

    Currently supports a single admin user whose password is set via the
    ADMIN_PASSWORD environment variable.
    """
    await _check_login_rate_limit(request)

    # Validate credentials
    if body.username != "admin" or body.password != settings.ADMIN_PASSWORD:
        # Log failed login attempt
        await log_audit_event(
            db=db,
            action=AuditAction.login_failed,
            user=body.username,
            request=request,
            success=False,
            error_message="Invalid username or password",
        )
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Generate token
    token = _create_access_token(subject=body.username)

    # Log successful login
    await log_audit_event(
        db=db,
        action=AuditAction.login_success,
        user=body.username,
        request=request,
        success=True,
    )
    await db.commit()

    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(username: str = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user."""
    return UserResponse(username=username)
