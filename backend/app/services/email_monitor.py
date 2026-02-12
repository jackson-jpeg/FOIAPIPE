"""Monitor IMAP inbox for FOIA response emails.

This module checks an IMAP inbox for responses from law enforcement agencies
to FOIA requests. It parses emails to extract:
- Case numbers
- Response type (acknowledged, denied, fulfilled, etc.)
- Cost estimates
- Fee waiver decisions
- Timeline extensions
- Attachments (downloaded to S3)

Used to automatically track FOIA request status by monitoring agency replies.
"""

from __future__ import annotations

import email
import logging
import os
import re
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Video/document file extensions we'll download from agency emails
_ATTACHMENT_EXTENSIONS = {
    # Video
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt",
    # Images
    ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp",
    # Archives
    ".zip", ".rar", ".7z", ".tar", ".gz",
}


async def check_inbox() -> list[dict]:
    """Check IMAP inbox for FOIA-related responses.

    Connects to IMAP server and searches for unread emails. Each email is
    parsed to extract FOIA-related information. Attachments from emails with
    a matched case number are saved to S3.

    Returns:
        List of dictionaries, one per email, containing parsed data:
            - case_number: Extracted FOIA case number (if found)
            - from: Sender email address
            - subject: Email subject
            - date: Email date
            - body: Email body text (truncated to 2000 chars)
            - response_type: Detected type (acknowledged, denied, fulfilled, etc.)
            - estimated_cost: Extracted cost amount (if mentioned)
            - fee_waiver: "granted" | "denied" | None
            - extension_days: Estimated extension days (if mentioned)
            - has_attachments: Boolean indicating if email has attachments
            - attachment_keys: List of S3 keys for saved attachments
    """
    if not all([settings.IMAP_HOST, settings.IMAP_USER, settings.IMAP_PASSWORD]):
        logger.warning("IMAP not configured (missing IMAP_HOST, IMAP_USER, or IMAP_PASSWORD)")
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
                # Download attachments to S3 if we matched a case number
                if parsed["case_number"] and parsed["has_attachments"]:
                    attachment_keys = _save_attachments(msg, parsed["case_number"])
                    parsed["attachment_keys"] = attachment_keys
                else:
                    parsed["attachment_keys"] = []

                results.append(parsed)
                # Mark email as read so it won't be reprocessed
                mail.store(num, '+FLAGS', '\\Seen')

        mail.close()
        mail.logout()
        return results
    except Exception as e:
        return [{"error": str(e)}]


def parse_foia_response(msg) -> Optional[dict]:
    """Parse an email message for FOIA response indicators.

    Extracts structured data from email messages to identify and classify
    FOIA responses from agencies. Detects fee waiver decisions and
    timeline extension requests.

    Args:
        msg: Email message object from imaplib

    Returns:
        Dictionary containing parsed email data, or None if email cannot be parsed
    """
    subject = msg.get("Subject", "")
    from_addr = msg.get("From", "")
    date = msg.get("Date", "")

    # Extract body (prefer plain text, fall back to HTML stripped of tags)
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode("utf-8", errors="replace")
                break
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode("utf-8", errors="replace")

    # Try to match FOIA case number (our format: FOIA-YYYY-NNNN)
    case_match = re.search(r"FOIA-\d{4}-\d{4}", subject + " " + body)
    case_number = case_match.group() if case_match else None

    combined = f"{subject} {body}".lower()

    # Detect response type (ordered by legal priority — most specific first)
    response_type = _detect_response_type(combined)

    # Extract cost if mentioned (find all dollar amounts, take the largest)
    estimated_cost = _extract_cost(body)

    # Detect fee waiver decision
    fee_waiver = _detect_fee_waiver(combined)

    # Detect timeline extension
    extension_days = _detect_extension(combined)

    # Check for attachments
    has_attachments = False
    attachment_count = 0
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_disposition() == "attachment":
                has_attachments = True
                attachment_count += 1

    return {
        "case_number": case_number,
        "from": from_addr,
        "subject": subject,
        "date": date,
        "body": body[:2000],
        "response_type": response_type,
        "estimated_cost": estimated_cost,
        "fee_waiver": fee_waiver,
        "extension_days": extension_days,
        "has_attachments": has_attachments,
        "attachment_count": attachment_count,
    }


def _detect_response_type(combined: str) -> str:
    """Classify the response type from email text using keyword matching.

    Ordered by legal priority — most specific/actionable first.
    """
    if any(w in combined for w in [
        "denied", "denial", "exempt", "withheld",
        "not a public record", "no responsive records",
    ]):
        return "denied"
    if any(w in combined for w in [
        "fee waiver", "waiver of fees", "no cost", "no charge",
    ]):
        return "fee_waiver"
    if any(w in combined for w in [
        "cost estimate", "fee estimate", "estimated cost",
        "payment required", "payment of $", "total fee",
    ]):
        return "cost_estimate"
    if any(w in combined for w in ["$", "cost", "fee", "payment"]):
        # Only match generic cost keywords if more specific ones didn't hit
        if any(w in combined for w in ["invoice", "billing", "amount due"]):
            return "cost_estimate"
    if any(w in combined for w in [
        "attached", "enclosed", "responsive documents",
        "fulfilled", "records enclosed", "responsive records",
        "please find", "records are available",
    ]):
        return "fulfilled"
    if any(w in combined for w in [
        "extension", "additional time", "10-day extension",
        "additional 10", "need more time",
    ]):
        return "extension"
    if any(w in combined for w in [
        "acknowledge", "received", "receipt", "confirm",
        "we have received your request",
    ]):
        return "acknowledged"
    if any(w in combined for w in ["processing", "being processed", "in progress"]):
        return "processing"
    return "unknown"


def _extract_cost(body: str) -> Optional[float]:
    """Extract the most relevant dollar amount from email body.

    Finds all dollar amounts and returns the largest, which is typically
    the total cost estimate rather than a per-page or per-hour rate.
    """
    amounts = []
    for match in re.finditer(r"\$\s*([\d,]+\.?\d{0,2})", body):
        try:
            val = float(match.group(1).replace(",", ""))
            if val > 0:
                amounts.append(val)
        except ValueError:
            continue
    return max(amounts) if amounts else None


def _detect_fee_waiver(combined: str) -> Optional[str]:
    """Detect if a fee waiver was granted or denied."""
    if any(w in combined for w in [
        "fee waiver granted", "waiver approved", "no cost",
        "no charge", "fees waived", "waiving the fee",
    ]):
        return "granted"
    if any(w in combined for w in [
        "fee waiver denied", "waiver denied", "cannot waive",
        "unable to waive", "waiver request denied",
    ]):
        return "denied"
    return None


def _detect_extension(combined: str) -> Optional[int]:
    """Detect timeline extension and estimate the number of days."""
    # Florida Statute 119 allows a 10-day extension
    if "10-day extension" in combined or "10 day extension" in combined:
        return 10
    # Look for "N additional days" pattern
    ext_match = re.search(r"(\d+)\s*(?:additional|more|extra)\s*(?:business\s*)?days", combined)
    if ext_match:
        return int(ext_match.group(1))
    # Generic extension mention without specific days — assume statutory 10
    if any(w in combined for w in ["extension", "additional time", "need more time"]):
        return 10
    return None


def _save_attachments(msg, case_number: str) -> list[str]:
    """Save email attachments to S3 storage.

    Only saves files with recognized extensions. Returns list of S3 keys.
    """
    saved_keys = []

    try:
        from app.services.storage import upload_file
    except Exception as e:
        logger.error(f"Cannot import storage for attachment save: {e}")
        return saved_keys

    if not settings.S3_BUCKET_NAME:
        logger.warning("S3 not configured, skipping attachment download")
        return saved_keys

    for part in msg.walk():
        if part.get_content_disposition() != "attachment":
            continue

        filename = part.get_filename()
        if not filename:
            continue

        # Sanitize filename
        filename = re.sub(r'[^\w\-_. ]', '_', filename)
        ext = os.path.splitext(filename)[1].lower()

        if ext not in _ATTACHMENT_EXTENSIONS:
            logger.debug(f"Skipping attachment with unrecognized extension: {filename}")
            continue

        try:
            payload = part.get_payload(decode=True)
            if not payload:
                continue

            storage_key = f"foia/attachments/{case_number}/{filename}"
            content_type = part.get_content_type() or "application/octet-stream"
            upload_file(payload, storage_key, content_type)
            saved_keys.append(storage_key)
            logger.info(f"Saved attachment {filename} ({len(payload)} bytes) for {case_number}")
        except Exception as e:
            logger.error(f"Failed to save attachment {filename} for {case_number}: {e}")

    return saved_keys
