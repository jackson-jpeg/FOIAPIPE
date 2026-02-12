"""Claude API client for article classification and video metadata generation.

This module provides AI-powered content generation using Anthropic's Claude API:
- Generate YouTube video metadata (titles, descriptions, tags)
- Fallback to template-based generation if API unavailable

Uses Claude Haiku model for fast, cost-effective generation with automatic
retry logic for transient failures.
"""

import logging
from typing import Optional

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
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def generate_video_metadata(
    incident_summary: str,
    agency: str,
    incident_date: str,
    incident_type: str = "",
) -> dict:
    """Generate YouTube-optimized metadata using Claude AI.

    Uses Claude Haiku to generate professional, SEO-optimized YouTube metadata
    based on incident details. Falls back to template-based generation if API
    is unavailable or fails.

    Args:
        incident_summary: Brief description of the incident
        agency: Law enforcement agency name
        incident_date: Date of incident (formatted string)
        incident_type: Type of incident (optional, for context)

    Returns:
        Dictionary containing:
            - titles: List of 3 alternative titles (each under 100 chars)
            - description: 2-3 paragraph description with required disclaimer
            - tags: List of 15-20 relevant tags for SEO

    Note:
        Retries up to 3 times with exponential backoff (2-10s) on connection errors.
        All titles start with "BODYCAM:" prefix.
        Description includes Florida Public Records Act disclaimer.

    Example:
        >>> metadata = await generate_video_metadata(
        ...     "Officer-involved shooting",
        ...     "Tampa Police Department",
        ...     "February 9, 2026"
        ... )
        >>> print(metadata['titles'][0])
        "BODYCAM: Officer-Involved Shooting — Tampa Police Department Feb 9, 2026"
    """
    if not settings.ANTHROPIC_API_KEY:
        return _fallback_metadata(incident_summary, agency, incident_date)

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = f"""Generate YouTube metadata for a police bodycam video:

Incident: {incident_summary}
Agency: {agency}
Date: {incident_date}
Type: {incident_type}

Provide exactly this JSON structure:
{{
  "titles": [
    "BODYCAM: <factual title> — {agency} {incident_date}",
    "BODYCAM: <attention-grabbing title> — {agency}",
    "BODYCAM: <descriptive title> — {agency} {incident_date}"
  ],
  "description": "<2-3 paragraph description with summary, factual details, and a disclaimer>",
  "tags": ["bodycam", "body camera", "<15-20 relevant tags>"]
}}

Rules:
- Titles must be under 100 characters
- Titles must start with "BODYCAM:"
- Description must include: "This footage was obtained through a public records request under Florida's Public Records Act (Chapter 119, Florida Statutes)."
- Tags should include: agency name, city, state, incident type keywords
- Be factual and journalistic, not sensational"""

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        text = response.content[0].text
        # Try to extract JSON from the response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            return result

        return _fallback_metadata(incident_summary, agency, incident_date)
    except Exception as e:
        logger.error(f"AI metadata generation failed: {e}")
        return _fallback_metadata(incident_summary, agency, incident_date)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def generate_foia_suggestions(
    request_text: str,
    agency_name: str = "",
    incident_type: str = "",
) -> list[str]:
    """Generate contextual improvement suggestions for a FOIA request using Claude AI.

    Analyzes the request text and returns actionable suggestions to improve
    legal completeness, specificity, and likelihood of fulfillment.

    Args:
        request_text: The FOIA request text to analyze
        agency_name: Name of the target agency (for context)
        incident_type: Type of incident (for context)

    Returns:
        List of 3-5 suggestion strings
    """
    if not settings.ANTHROPIC_API_KEY:
        return _fallback_suggestions()

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        context_parts = []
        if agency_name:
            context_parts.append(f"Target agency: {agency_name}")
        if incident_type:
            context_parts.append(f"Incident type: {incident_type}")
        context = "\n".join(context_parts)

        prompt = f"""Analyze this Florida public records request and provide 3-5 specific, actionable suggestions to improve it. Focus on:
- Legal completeness (Chapter 119, Florida Statutes references)
- Specificity of records requested (dates, document types, personnel)
- Format preferences (electronic vs. paper)
- Fee waiver language
- Timeline clarity

{f"Context:{chr(10)}{context}{chr(10)}" if context else ""}
Request text:
{request_text}

Return ONLY a JSON array of suggestion strings, no other text. Example:
["suggestion 1", "suggestion 2", "suggestion 3"]"""

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        text = response.content[0].text
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            suggestions = json.loads(text[start:end])
            if isinstance(suggestions, list) and all(isinstance(s, str) for s in suggestions):
                return suggestions[:5]

        return _fallback_suggestions()
    except Exception as e:
        logger.error(f"AI FOIA suggestions failed: {e}")
        return _fallback_suggestions()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def classify_email_response(
    subject: str, body: str, case_number: str | None = None,
) -> dict | None:
    """Classify an email response using Claude AI.

    Analyzes the subject and body of an agency email response to determine
    the response type (acknowledged, denied, fulfilled, etc.) and extract
    structured metadata like cost estimates and extension days.

    Args:
        subject: Email subject line
        body: Email body text (truncated to 1500 chars)
        case_number: Optional FOIA case number for context

    Returns:
        Dictionary with response_type, confidence, and optional fields,
        or None on failure or if API key not set.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

    try:
        import anthropic
        import json

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        truncated_body = body[:1500] if body else ""
        case_context = f"\nCase Number: {case_number}" if case_number else ""

        prompt = f"""Classify this FOIA email response. Return ONLY valid JSON.
{case_context}
Subject: {subject}
Body: {truncated_body}

Return this exact JSON structure:
{{
  "response_type": "<one of: acknowledged, denied, fulfilled, cost_estimate, fee_waiver, extension, processing, unknown>",
  "confidence": "<one of: high, medium, low>",
  "estimated_cost": <float or null>,
  "fee_waiver": "<one of: granted, denied, null>",
  "extension_days": <int or null>
}}

Rules:
- response_type "acknowledged" = agency confirms receipt
- response_type "fulfilled" = records are attached or ready for pickup
- response_type "denied" = request denied with reason
- response_type "cost_estimate" = agency quotes a price
- response_type "fee_waiver" = response about fee waiver request
- response_type "extension" = agency requests more time
- response_type "processing" = agency says they are working on it
- response_type "unknown" = cannot determine"""

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            return result

        return None
    except Exception as e:
        logger.error(f"AI email classification failed: {e}")
        return None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def generate_followup_letter(
    original_request_text: str, case_number: str, agency_name: str,
    days_overdue: int, last_response_type: str | None = None,
) -> str:
    """Generate a follow-up letter for an overdue FOIA request using Claude AI.

    Creates a professional follow-up letter citing Florida Statute 119.07,
    referencing the original case number, and noting days overdue.

    Args:
        original_request_text: The original FOIA request text
        case_number: The FOIA case number
        agency_name: Name of the agency
        days_overdue: Number of days past the due date
        last_response_type: Type of last response received, if any

    Returns:
        Follow-up letter text as a string.
    """
    if not settings.ANTHROPIC_API_KEY:
        return _fallback_followup_letter(case_number, agency_name, days_overdue)

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        last_response_context = ""
        if last_response_type:
            last_response_context = f"\nLast response type from agency: {last_response_type}"

        prompt = f"""Write a professional follow-up letter for an overdue Florida public records request.

Case Number: {case_number}
Agency: {agency_name}
Days Overdue: {days_overdue}
{last_response_context}

Original request (abbreviated):
{original_request_text[:800]}

Requirements:
- Cite Florida Statute 119.07 (public records act)
- Reference the case number
- Note it is {days_overdue} days overdue
- Request a status update and estimated completion date
- Be firm but professional
- Keep it under 300 words
- Do not include [brackets] or placeholders — write the actual letter text
- Sign off as "Records Request Department, FOIA Archive"

Return ONLY the letter text, no JSON or markdown formatting."""

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"AI follow-up letter generation failed: {e}")
        return _fallback_followup_letter(case_number, agency_name, days_overdue)


def _fallback_followup_letter(case_number: str, agency_name: str, days_overdue: int) -> str:
    """Generate a template-based follow-up letter when AI is unavailable."""
    return f"""Re: Public Records Request - {case_number}

Dear Records Custodian,

I am writing to follow up on public records request {case_number}, submitted to {agency_name}, which is now {days_overdue} days overdue.

Under Florida Statute 119.07, public records requests must be fulfilled promptly. The statute does not provide for indefinite delays, and agencies are required to act on requests within a reasonable time frame.

I respectfully request:
1. A status update on the processing of this request
2. An estimated date of completion
3. If there are any fees associated, please provide a cost estimate

If this request has been fulfilled or if additional information is needed from our end, please notify us at your earliest convenience.

Thank you for your attention to this matter.

Sincerely,
Records Request Department
FOIA Archive
recordsrequest@foiaarchive.com"""


def _fallback_suggestions() -> list[str]:
    """Return generic FOIA improvement tips when AI is unavailable."""
    return [
        "Reference Chapter 119, Florida Statutes to establish your legal basis",
        "Specify exact date ranges for the records you are requesting",
        "Request records in electronic format to reduce duplication costs",
        "Include fee waiver language or state willingness to pay reasonable fees",
        "Clearly describe the specific types of records needed (e.g., body camera footage, incident reports, dispatch logs)",
    ]


def _fallback_metadata(summary: str, agency: str, date: str) -> dict:
    """Generate basic metadata without AI using templates.

    Provides fallback metadata generation when Claude API is unavailable
    or API key is not configured.

    Args:
        summary: Incident summary (will be truncated to 60 chars for titles)
        agency: Agency name
        date: Incident date

    Returns:
        Dictionary with same structure as generate_video_metadata
    """
    short_summary = summary[:60] if len(summary) > 60 else summary
    return {
        "titles": [
            f"BODYCAM: {short_summary} — {agency} {date}",
            f"BODYCAM: {agency} Incident — {date}",
            f"BODYCAM: {short_summary} — {agency}",
        ],
        "description": (
            f"Body-worn camera footage from {agency} related to: {summary}.\n\n"
            f"Date: {date}\n\n"
            f"This footage was obtained through a public records request under "
            f"Florida's Public Records Act (Chapter 119, Florida Statutes).\n\n"
            f"Disclaimer: This video is released as a matter of public record. "
            f"All individuals shown are presumed innocent until proven guilty."
        ),
        "tags": [
            "bodycam", "body camera", "police", "body worn camera",
            agency, "Florida", "public records", "FOIA",
            "law enforcement", "police video", "Tampa Bay",
        ],
    }
