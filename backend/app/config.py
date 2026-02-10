"""Application configuration loaded from environment variables.

All settings are loaded using Pydantic Settings from .env files or environment variables.
Required settings will raise validation errors if missing.

Environment Files:
    - .env in project root (primary)
    - .env in backend/ directory (fallback)

Security Note:
    - Never commit .env files to version control
    - Use .env.example as a template
    - Rotate secrets regularly in production
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All application settings, loaded from .env or environment variables.

    Required Settings (will raise error if missing):
        - DATABASE_URL: PostgreSQL connection string
        - SECRET_KEY: JWT signing key (generate with: openssl rand -hex 32)
        - ADMIN_PASSWORD: Admin user password

    Optional Settings:
        - All external API keys (SMTP, YouTube, Anthropic, etc.)
        - If external services are not configured, related features will be disabled
    """

    # ── Application ───────────────────────────────────────────────────────
    DEBUG: bool = False  # Set to True for development (enables API docs, verbose logging)

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/foiapipe"

    # ── Redis / Celery ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Authentication ────────────────────────────────────────────────────
    SECRET_KEY: str
    ADMIN_PASSWORD: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 120  # 2 hours (reduced from 24 for security)

    # ── SMTP (outbound email) ─────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@foiapipe.local"

    # ── IMAP (inbound email) ──────────────────────────────────────────────
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""

    # ── S3 / Object Storage ───────────────────────────────────────────────
    S3_ENDPOINT: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = "us-east-1"

    # ── YouTube ───────────────────────────────────────────────────────────
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REFRESH_TOKEN: str = ""

    # ── Anthropic (Claude AI) ─────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""

    # ── Twilio (SMS notifications) ────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    NOTIFICATION_PHONE: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    model_config = {
        "env_file": ("../.env", ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()  # type: ignore[call-arg]
