"""Send notifications via email, SMS, and in-app."""

import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


async def send_notification(event_type: str, data: dict) -> dict:
    """Dispatch a notification based on event type and user preferences."""
    title = data.get("title", event_type)
    message = data.get("message", "")
    link = data.get("link")

    results = {"in_app": False, "email": False, "sms": False}

    # Always save in-app notification
    try:
        await _save_in_app_notification(event_type, title, message, link)
        results["in_app"] = True
    except Exception as e:
        logger.error(f"In-app notification failed: {e}")

    # Email notification
    if settings.SMTP_HOST and settings.FROM_EMAIL:
        try:
            await _send_email_notification(title, message)
            results["email"] = True
        except Exception as e:
            logger.error(f"Email notification failed: {e}")

    # SMS notification
    if settings.TWILIO_ACCOUNT_SID and settings.NOTIFICATION_PHONE:
        try:
            await _send_sms_notification(message)
            results["sms"] = True
        except Exception as e:
            logger.error(f"SMS notification failed: {e}")

    return results


async def _save_in_app_notification(
    event_type: str, title: str, message: str, link: Optional[str] = None
):
    """Store notification in database for in-app display."""
    from app.database import async_session_factory
    from app.models.notification import (
        Notification,
        NotificationChannel,
        NotificationType,
    )

    type_map = {
        "foia_submitted": NotificationType.foia_submitted,
        "foia_acknowledged": NotificationType.foia_acknowledged,
        "foia_fulfilled": NotificationType.foia_fulfilled,
        "foia_denied": NotificationType.foia_denied,
        "foia_overdue": NotificationType.foia_overdue,
        "foia_deadline": NotificationType.foia_overdue,
        "scan_complete": NotificationType.scan_complete,
        "video_uploaded": NotificationType.video_uploaded,
        "video_published": NotificationType.video_published,
        "daily_summary": NotificationType.system_error,
        "revenue_milestone": NotificationType.revenue_milestone,
    }

    async with async_session_factory() as db:
        notif = Notification(
            type=type_map.get(event_type, NotificationType.system_error),
            channel=NotificationChannel.in_app,
            title=title,
            message=message,
            link=link,
            sent_at=datetime.now(timezone.utc),
        )
        db.add(notif)
        await db.commit()


async def _send_email_notification(subject: str, body: str):
    """Send email notification."""
    import aiosmtplib
    from email.mime.text import MIMEText

    if not settings.SMTP_HOST:
        return

    msg = MIMEText(body)
    msg["Subject"] = f"[FOIAPIPE] {subject}"
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = settings.SMTP_USER or settings.FROM_EMAIL

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        use_tls=settings.SMTP_PORT == 465,
        start_tls=settings.SMTP_PORT == 587,
    )


async def _send_sms_notification(message: str):
    """Send SMS via Twilio."""
    if not settings.TWILIO_ACCOUNT_SID:
        return

    import httpx

    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    async with httpx.AsyncClient() as client:
        await client.post(
            url,
            data={
                "Body": f"[FOIAPIPE] {message[:140]}",
                "From": settings.TWILIO_FROM_NUMBER,
                "To": settings.NOTIFICATION_PHONE,
            },
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        )
