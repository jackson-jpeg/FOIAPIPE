"""Classify news articles by incident type, detect agencies, and score severity."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.models.news_article import NewsArticle

AGENCY_PATTERNS: dict[str, list[str]] = {
    "Tampa Police Department": ["tampa police", "tpd", "tampa pd"],
    "Hillsborough County Sheriff's Office": [
        "hillsborough county sheriff",
        "hcso",
        "hillsborough sheriff",
    ],
    "St. Petersburg Police Department": [
        "st. petersburg police",
        "st pete police",
        "sppd",
        "st. pete pd",
    ],
    "Pinellas County Sheriff's Office": [
        "pinellas county sheriff",
        "pcso",
        "pinellas sheriff",
    ],
    "Clearwater Police Department": [
        "clearwater police",
        "clearwater pd",
        "cpd clearwater",
    ],
    "Pasco County Sheriff's Office": [
        "pasco county sheriff",
        "pasco sheriff",
        "paso",
    ],
    "Temple Terrace Police Department": [
        "temple terrace police",
        "temple terrace pd",
        "ttpd",
    ],
    "Plant City Police Department": [
        "plant city police",
        "plant city pd",
        "pcpd",
    ],
    "Florida Highway Patrol": [
        "florida highway patrol",
        "fhp",
        "highway patrol",
    ],
    "USF Police Department": [
        "usf police",
        "university of south florida police",
        "usfpd",
    ],
}

INCIDENT_KEYWORDS: dict[str, list[str]] = {
    "ois": [
        "shooting",
        "shot",
        "officer-involved shooting",
        "officer involved shooting",
        "shots fired",
        "gunfire",
        "fired weapon",
        "discharged",
        "fatal shooting",
    ],
    "use_of_force": [
        "force",
        "beat",
        "beating",
        "punch",
        "punched",
        "slam",
        "slammed",
        "excessive force",
        "rough",
        "brutality",
        "struck",
        "hit",
        "choke",
        "restrain",
    ],
    "pursuit": [
        "pursuit",
        "chase",
        "chased",
        "flee",
        "fled",
        "fleeing",
        "high-speed",
        "high speed",
        "vehicle pursuit",
        "foot chase",
    ],
    "taser": [
        "taser",
        "tased",
        "stun gun",
        "stunned",
        "conducted energy",
        "electroshock",
    ],
    "k9": ["k-9", "k9", "canine", "police dog", "dog bite"],
    "arrest": [
        "arrest",
        "arrested",
        "detained",
        "custody",
        "handcuff",
        "booking",
        "taken into custody",
    ],
    "dui": [
        "dui",
        "drunk driving",
        "driving under the influence",
        "impaired driving",
        "dwi",
        "intoxicated driver",
    ],
}

SEVERITY_BASE_SCORES: dict[str, int] = {
    "ois": 9,
    "use_of_force": 7,
    "pursuit": 6,
    "taser": 5,
    "k9": 5,
    "arrest": 3,
    "dui": 3,
    "other": 2,
}


def detect_agency(text: str, agency_names: Optional[list[str]] = None) -> Optional[str]:
    """Detect which law enforcement agency is mentioned in the text."""
    text_lower = text.lower()
    for agency_name, patterns in AGENCY_PATTERNS.items():
        for pattern in patterns:
            if pattern in text_lower:
                return agency_name
    return None


def classify_incident(headline: str, body: str = "") -> str:
    """Classify the type of incident from headline and body text."""
    combined = f"{headline} {body}".lower()
    # Check in priority order (most severe first)
    for incident_type in [
        "ois",
        "use_of_force",
        "pursuit",
        "taser",
        "k9",
        "dui",
        "arrest",
    ]:
        keywords = INCIDENT_KEYWORDS[incident_type]
        for keyword in keywords:
            if keyword in combined:
                return incident_type
    return "other"


def score_severity(incident_type: str, text: str) -> int:
    """Score the severity of an incident from 1-10."""
    score = SEVERITY_BASE_SCORES.get(incident_type, 2)
    text_lower = text.lower()

    # Modifiers
    if any(
        w in text_lower
        for w in ["officer named", "identified the officer", "officer identified"]
    ):
        score += 1
    if any(
        w in text_lower
        for w in ["killed", "death", "died", "fatal", "deceased"]
    ):
        score += 2
    elif any(
        w in text_lower
        for w in ["injured", "injury", "hospital", "hospitalized", "wounded"]
    ):
        score += 1
    if any(
        w in text_lower
        for w in ["multiple officers", "several officers", "officers involved"]
    ):
        score += 1
    if any(
        w in text_lower
        for w in [
            "bodycam",
            "body cam",
            "body-worn camera",
            "body camera",
            "dash cam",
            "dashcam",
        ]
    ):
        score += 1
    if any(
        w in text_lower
        for w in [
            "complaint",
            "internal affairs",
            "prior incident",
            "history of",
        ]
    ):
        score += 1

    return min(score, 10)


async def classify_article_with_ai(
    headline: str,
    body: str,
    agency_names: list[str],
) -> dict:
    """Classify article using Claude Haiku for semantic understanding.

    Args:
        headline: Article headline
        body: Article body text (will be truncated to 1000 chars)
        agency_names: List of known agency names to choose from

    Returns:
        dict with keys: detected_agency, incident_type, severity, confidence, reasoning
        Falls back to regex classification if API key not available.
    """
    # Fallback to regex if no API key
    if not settings.ANTHROPIC_API_KEY:
        logger.info("No ANTHROPIC_API_KEY, using regex classification")
        return {
            "detected_agency": detect_agency(f"{headline} {body}", agency_names),
            "incident_type": classify_incident(headline, body),
            "severity": score_severity(classify_incident(headline, body), f"{headline} {body}"),
            "confidence": "medium",
            "reasoning": "Regex-based classification (no API key)",
            "method": "regex",
        }

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        # Truncate body to 1000 chars for cost optimization
        truncated_body = body[:1000] if len(body) > 1000 else body

        prompt = f"""Analyze this law enforcement news article and extract structured information.

HEADLINE: {headline}

BODY: {truncated_body}

KNOWN AGENCIES (choose the best match or "unknown"):
{', '.join(agency_names)}

INCIDENT TYPES (choose one):
- ois (officer-involved shooting)
- use_of_force (physical force, baton, restraint)
- pursuit (vehicle/foot chase)
- taser (conducted energy weapon)
- k9 (police dog deployment)
- dui (impaired driving by officer or suspect)
- arrest (routine arrest)
- other

Provide ONLY valid JSON in this exact format:
{{
  "detected_agency": "<agency name from list or 'unknown'>",
  "incident_type": "<one of the incident types above>",
  "severity": <integer 1-10, where 1=routine, 5=notable, 10=critical>,
  "confidence": "<high|medium|low>",
  "reasoning": "<1 sentence explaining your classification>"
}}

Severity scoring guidance:
- 1-3: Routine incident (standard arrest, minor complaint)
- 4-6: Notable incident (use of force, pursuit, injuries)
- 7-8: Serious incident (OIS, significant injuries, multiple officers)
- 9-10: Critical incident (fatality, major controversy, identified officer)"""

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()

        # Extract JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            result["method"] = "claude_haiku"
            logger.info(
                f"AI classified: agency={result.get('detected_agency')}, "
                f"type={result.get('incident_type')}, "
                f"severity={result.get('severity')}, "
                f"confidence={result.get('confidence')}"
            )
            return result

        raise ValueError("No JSON found in Claude response")

    except Exception as e:
        logger.error(f"AI classification failed: {e}, falling back to regex")
        return {
            "detected_agency": detect_agency(f"{headline} {body}", agency_names),
            "incident_type": classify_incident(headline, body),
            "severity": score_severity(classify_incident(headline, body), f"{headline} {body}"),
            "confidence": "medium",
            "reasoning": f"Regex fallback (AI error: {str(e)})",
            "method": "regex_fallback",
        }


def assess_auto_foia_eligibility(
    severity_score: int,
    agency_has_email: bool,
    agency_is_active: bool,
    threshold: int = 6,
) -> bool:
    """Determine if an article qualifies for automatic FOIA filing."""
    return severity_score >= threshold and agency_has_email and agency_is_active


async def classify_and_score_article(
    article: NewsArticle, db: AsyncSession
) -> NewsArticle:
    """Run full classification pipeline on an article. Mutates and returns the article."""
    from app.models.agency import Agency

    # Fetch all agency names for AI classification
    agency_result = await db.execute(select(Agency.name))
    agency_names = [name for (name,) in agency_result.all()]

    # Use AI classification (falls back to regex if no API key)
    classification = await classify_article_with_ai(
        headline=article.headline or "",
        body=article.body or "",
        agency_names=agency_names,
    )

    # Apply classification results
    article.detected_agency = classification.get("detected_agency")
    if article.detected_agency == "unknown":
        article.detected_agency = None

    article.incident_type = classification.get("incident_type", "other")
    article.severity_score = classification.get("severity", 5)

    # Store AI reasoning in summary field if available
    if classification.get("reasoning"):
        article.summary = classification.get("reasoning")

    logger.info(
        f"Classified article {article.id}: method={classification.get('method')}, "
        f"agency={article.detected_agency}, type={article.incident_type}, "
        f"severity={article.severity_score}, confidence={classification.get('confidence')}"
    )

    # Check auto-FOIA eligibility
    if article.detected_agency:
        result = await db.execute(
            select(Agency).where(Agency.name == article.detected_agency).limit(1)
        )
        agency = result.scalar_one_or_none()
        if agency:
            article.auto_foia_eligible = assess_auto_foia_eligibility(
                article.severity_score,
                bool(agency.foia_email),
                agency.is_active,
            )

    return article
