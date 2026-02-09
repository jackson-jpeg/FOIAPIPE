"""Unit tests for the email monitor FOIA response parser."""

from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.services.email_monitor import parse_foia_response


def _make_email(subject: str, body: str, *, attachments: list[tuple[str, bytes]] | None = None):
    """Build a minimal email.message.Message for testing."""
    if attachments:
        msg = MIMEMultipart()
        msg.attach(MIMEText(body, "plain"))
        for filename, content in attachments:
            part = MIMEApplication(content, _subtype="pdf")
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)
    else:
        msg = MIMEText(body, "plain")
    msg["Subject"] = subject
    msg["From"] = "records@agency.gov"
    msg["Date"] = "Mon, 09 Feb 2026 12:00:00 GMT"
    return msg


def test_parse_foia_response_acknowledged():
    """Acknowledge keywords map to 'acknowledged' response type."""
    msg = _make_email(
        subject="Re: Public Records Request – FOIA-2026-0042",
        body="We acknowledge receipt of your request FOIA-2026-0042. "
        "Your request has been received and is being processed.",
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["response_type"] == "acknowledged"
    assert result["case_number"] == "FOIA-2026-0042"


def test_parse_foia_response_denied():
    """Denial keywords map to 'denied' response type."""
    msg = _make_email(
        subject="Records Request Denial",
        body="Your request FOIA-2026-0099 has been denied. "
        "The requested records are exempt under Florida law.",
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["response_type"] == "denied"
    assert result["case_number"] == "FOIA-2026-0099"


def test_parse_foia_response_fulfilled():
    """Fulfillment keywords map to 'fulfilled' response type."""
    msg = _make_email(
        subject="Records Ready - FOIA-2026-0050",
        body="Please find the responsive records attached to this email. "
        "Your request FOIA-2026-0050 has been fulfilled.",
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["response_type"] == "fulfilled"


def test_parse_foia_response_cost_estimate():
    """Cost estimate emails are detected and dollar amount extracted."""
    msg = _make_email(
        subject="Cost Estimate for FOIA-2026-0075",
        body="The estimated cost for duplication is $50.00. "
        "Please remit payment before we proceed.",
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["response_type"] == "cost_estimate"
    assert result["estimated_cost"] == 50.00
    assert result["case_number"] == "FOIA-2026-0075"


def test_parse_foia_response_no_case_number():
    """Emails without a FOIA case number still parse but return None case_number."""
    msg = _make_email(
        subject="Re: Records Request",
        body="We received your request and will respond shortly.",
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["case_number"] is None
    assert result["response_type"] == "acknowledged"


def test_parse_foia_response_attachments():
    """Attachment detection works for multipart emails."""
    msg = _make_email(
        subject="Records - FOIA-2026-0060",
        body="Attached are the responsive records.",
        attachments=[("bodycam.pdf", b"%PDF-fake")],
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["has_attachments"] is True
    assert result["response_type"] == "fulfilled"


def test_parse_foia_response_large_cost():
    """Large dollar amounts with commas are parsed correctly."""
    msg = _make_email(
        subject="Fee Estimate",
        body="The total fee for this request is $1,250.75.",
    )
    result = parse_foia_response(msg)
    assert result is not None
    assert result["estimated_cost"] == 1250.75
