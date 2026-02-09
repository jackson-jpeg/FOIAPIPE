"""Claude API client for article classification and video metadata generation."""
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


async def generate_video_metadata(
    incident_summary: str,
    agency: str,
    incident_date: str,
    incident_type: str = "",
) -> dict:
    """Generate YouTube-optimized title, description, and tags using Claude."""
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


def _fallback_metadata(summary: str, agency: str, date: str) -> dict:
    """Generate basic metadata without AI."""
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
