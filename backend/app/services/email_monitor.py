"""Monitor IMAP inbox for FOIA response emails.

This module checks an IMAP inbox for responses from law enforcement agencies
to FOIA requests. It parses emails to extract:
- Case numbers
- Response type (acknowledged, denied, fulfilled, etc.)
- Cost estimates
- Attachments

Used to automatically track FOIA request status by monitoring agency replies.
"""

from __future__ import annotations

import email
import logging
import re
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


async def check_inbox() -> list[dict]:
    """Check IMAP inbox for FOIA-related responses.

    Connects to IMAP server and searches for unread emails. Each email is
    parsed to extract FOIA-related information.

    Returns:
        List of dictionaries, one per email, containing parsed data:
            - case_number: Extracted FOIA case number (if found)
            - from: Sender email address
            - subject: Email subject
            - date: Email date
            - body: Email body text (truncated to 2000 chars)
            - response_type: Detected type (acknowledged, denied, fulfilled, etc.)
            - estimated_cost: Extracted cost amount (if mentioned)
            - has_attachments: Boolean indicating if email has attachments

    Note:
        Returns empty list if IMAP is not configured.
        Returns list with error dict if connection fails.

    Example:
        >>> emails = await check_inbox()
        >>> for email in emails:
        ...     if email.get('case_number'):
        ...         print(f"Response for {email['case_number']}: {email['response_type']}")
    """
    if not all([settings.IMAP_HOST, settings.IMAP_USER, settings.IMAP_PASSWORD]):
        return []

    try:
        import imaplib

        mail = imaplib.IMAP4_SSL(settings.IMAP_HOST, settings.IMAP_PORT)
        mail.login(settings.IMAP_USER, settings.IMAP_PASSWORD)
        mail.select("INBOX")

        # Search for unread emails
        _, message_numbers = mail.search(None, "UNSEEN")

        results = []
        for num in message_numbers[0].split():
            _, msg_data = mail.fetch(num, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])

            parsed = parse_foia_response(msg)
            if parsed:
                results.append(parsed)

        mail.close()
        mail.logout()
        return results
    except Exception as e:
        return [{"error": str(e)}]


def parse_foia_response(msg) -> Optional[dict]:
    """Parse an email message for FOIA response indicators.

    Extracts structured data from email messages to identify and classify
    FOIA responses from agencies.

    Args:
        msg: Email message object from imaplib

    Returns:
        Dictionary containing parsed email data (see check_inbox for structure),
        or None if email cannot be parsed

    Note:
        Detection logic:
        - Case numbers: Regex pattern FOIA-YYYY-NNNN
        - Response types: Keyword matching in subject/body
        - Costs: Dollar amount extraction with regex
        - Attachments: Checks for MIME attachments
    """
    subject = msg.get("Subject", "")
    from_addr = msg.get("From", "")
    date = msg.get("Date", "")

    # Extract body
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                break
    else:
        body = msg.get_payload(decode=True).decode("utf-8", errors="replace")

    # Try to match FOIA case number
    case_match = re.search(r"FOIA-\d{4}-\d{4}", subject + " " + body)
    case_number = case_match.group() if case_match else None

    # Detect response type
    combined = f"{subject} {body}".lower()
    response_type = "unknown"
    if any(w in combined for w in ["acknowledge", "received", "receipt", "confirm"]):
        response_type = "acknowledged"
    elif any(w in combined for w in ["denied", "denial", "exempt", "withheld"]):
        response_type = "denied"
    elif any(w in combined for w in ["attached", "enclosed", "records", "responsive", "fulfilled"]):
        response_type = "fulfilled"
    elif any(w in combined for w in ["cost", "fee", "payment", "estimate", "$"]):
        response_type = "cost_estimate"
    elif any(w in combined for w in ["extension", "additional time", "delay"]):
        response_type = "processing"

    # Extract cost if mentioned
    cost_match = re.search(r"\$[\d,]+\.?\d{0,2}", body)
    estimated_cost = None
    if cost_match:
        try:
            estimated_cost = float(cost_match.group().replace("$", "").replace(",", ""))
        except ValueError:
            pass

    # Check for attachments
    has_attachments = False
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_disposition() == "attachment":
                has_attachments = True
                break

    return {
        "case_number": case_number,
        "from": from_addr,
        "subject": subject,
        "date": date,
        "body": body[:2000],
        "response_type": response_type,
        "estimated_cost": estimated_cost,
        "has_attachments": has_attachments,
    }
