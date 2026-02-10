"""Send FOIA request emails via SMTP.

This module provides email sending functionality with automatic retries.
Used to submit FOIA requests to law enforcement agencies via email.

Features:
- Async SMTP with TLS/SSL support
- PDF attachment support
- Retry logic for transient failures (3 attempts with exponential backoff)
- Detailed error reporting
"""

from __future__ import annotations

import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from app.config import settings

logger = logging.getLogger(__name__)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((aiosmtplib.SMTPException, ConnectionError, TimeoutError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def send_foia_email(
    to_email: str,
    subject: str,
    body_text: str,
    pdf_bytes: Optional[bytes] = None,
    pdf_filename: str = "foia_request.pdf",
) -> dict:
    """Send a FOIA request email with optional PDF attachment.

    Uses configured SMTP settings from environment variables.
    Automatically retries up to 3 times with exponential backoff (2-10s)
    on SMTP errors.

    Args:
        to_email: Recipient email address (agency FOIA email)
        subject: Email subject line
        body_text: Email body (plain text)
        pdf_bytes: Optional PDF file content as bytes
        pdf_filename: Filename for PDF attachment (default: "foia_request.pdf")

    Returns:
        Dictionary with:
            - success: Boolean indicating if email was sent
            - message: Success or error message

    Raises:
        aiosmtplib.SMTPException: After 3 failed retry attempts
        ConnectionError: If SMTP server is unreachable
        TimeoutError: If connection times out

    Note:
        SMTP configuration is read from settings:
        - FROM_EMAIL: Sender email address
        - SMTP_HOST: SMTP server hostname
        - SMTP_PORT: SMTP server port (465 for TLS, 587 for STARTTLS)
        - SMTP_USER: SMTP username
        - SMTP_PASSWORD: SMTP password
    """
    msg = MIMEMultipart()
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(body_text, "plain"))

    if pdf_bytes:
        pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
        pdf_part.add_header("Content-Disposition", "attachment", filename=pdf_filename)
        msg.attach(pdf_part)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_PORT == 465,
            start_tls=settings.SMTP_PORT == 587,
        )
        return {"success": True, "message": "Email sent successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}
