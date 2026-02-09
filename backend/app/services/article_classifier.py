"""Classify news articles by incident type, detect agencies, and score severity."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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

    text = f"{article.headline or ''} {article.body or ''} {article.summary or ''}"

    # Detect agency
    detected = detect_agency(text)
    article.detected_agency = detected

    # Classify incident
    article.incident_type = classify_incident(
        article.headline or "", article.body or ""
    )

    # Score severity
    article.severity_score = score_severity(article.incident_type, text)

    # Check auto-FOIA eligibility
    if detected:
        result = await db.execute(
            select(Agency).where(Agency.name == detected).limit(1)
        )
        agency = result.scalar_one_or_none()
        if agency:
            article.auto_foia_eligible = assess_auto_foia_eligibility(
                article.severity_score,
                bool(agency.foia_email),
                agency.is_active,
            )

    return article
