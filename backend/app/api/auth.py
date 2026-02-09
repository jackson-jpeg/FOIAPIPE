"""Authentication router – login and JWT issuance."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt

from app.api.deps import get_current_user
from app.config import settings
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _create_access_token(subject: str) -> str:
    """Create a signed JWT with an expiration claim."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Validate credentials and return an access token.

    Currently supports a single admin user whose password is set via the
    ADMIN_PASSWORD environment variable.
    """
    if body.username != "admin" or body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = _create_access_token(subject=body.username)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(username: str = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user."""
    return UserResponse(username=username)
