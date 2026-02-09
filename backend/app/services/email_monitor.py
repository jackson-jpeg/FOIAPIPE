"""Monitor IMAP inbox for FOIA response emails."""

from __future__ import annotations

import email
import re
from typing import Optional

from app.config import settings


async def check_inbox() -> list[dict]:
    """Check IMAP inbox for FOIA-related responses. Returns list of parsed emails."""
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
    """Parse an email message for FOIA response indicators."""
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
