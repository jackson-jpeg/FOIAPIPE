"""Generate FOIA appeals for denied requests based on Florida law.

This service helps automate the appeal process when FOIA requests are denied.
It generates legally-sound appeal letters citing relevant Florida statutes.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


class DenialReason(str, Enum):
    """Common reasons for FOIA denial."""

    active_investigation = "active_investigation"
    public_safety = "public_safety"
    privacy = "privacy"
    excessive_cost = "excessive_cost"
    vague_request = "vague_request"
    no_records = "no_records"
    other = "other"


# Legal arguments for each denial reason (Florida Statutes)
APPEAL_ARGUMENTS = {
    DenialReason.active_investigation: {
        "statute": "Florida Statute § 119.071(2)(c)",
        "argument": """While active criminal investigative information may be exempt under Florida Statute § 119.071(2)(c), this exemption is discretionary, not mandatory. The statute states such records "may be made exempt," not "shall be exempt."

Furthermore, any exemption must be narrowly construed. Body camera footage of completed incidents where no ongoing investigation exists should be released. If only portions of the footage implicate an active investigation, Florida's public policy favors redaction rather than wholesale denial.

We request a detailed explanation of what specific portions of the requested records are subject to the active investigation exemption, and release of all non-exempt portions.""",
    },
    DenialReason.public_safety: {
        "statute": "Florida Statute § 119.071(2)",
        "argument": """The public safety exemption must be applied narrowly and with specific justification. Florida courts have consistently held that blanket denials based on generalized public safety concerns are insufficient.

The agency must demonstrate a clear and present danger that would result from disclosure, not merely speculative harm. Body camera footage of completed incidents that are now public knowledge rarely meets this threshold.

We request a detailed explanation of the specific public safety concerns and consideration of redaction of sensitive portions rather than complete denial.""",
    },
    DenialReason.privacy: {
        "statute": "Florida Statute § 119.071(2)(l)",
        "argument": """While Florida law protects certain privacy interests, body camera footage of law enforcement activities in public spaces generally does not qualify for blanket privacy exemptions.

The Florida Supreme Court has held that privacy interests must be balanced against the public's right to know about government activities. Where privacy concerns exist, the appropriate remedy is redaction or blurring of faces/identifying information, not wholesale denial.

We are willing to accept redacted footage that protects legitimate privacy interests while still allowing public oversight of law enforcement conduct.""",
    },
    DenialReason.excessive_cost: {
        "statute": "Florida Statute § 119.07(1)(a)",
        "argument": """Florida law requires agencies to provide records at reasonable costs for duplication. The statute does not allow agencies to deny requests based on excessive cost alone.

If the agency believes the cost is excessive, they must provide a good faith estimate and allow the requester to:
1. Narrow the scope of the request
2. Accept a partial fulfillment
3. Pay the estimated cost

We request an itemized cost estimate and are willing to negotiate the scope of the request to reduce costs while still obtaining meaningful access to public records.""",
    },
    DenialReason.vague_request: {
        "statute": "Florida Statute § 119.07",
        "argument": """Our request specifically identifies the incident date, location, and officers involved. Florida law does not require requesters to identify records with absolute precision, only to reasonably describe them.

We have provided sufficient detail for the agency to identify and locate the responsive records. If clarification is needed, the agency should contact us rather than denying the request outright.

We are happy to work with the agency to refine the request if needed, but the current request is sufficiently specific under Florida law.""",
    },
    DenialReason.no_records: {
        "statute": "Florida Statute § 119.07",
        "argument": """We respectfully question whether a diligent search was conducted for the requested records. Body camera footage of the specified incident should exist if officers were present.

Florida law requires agencies to conduct reasonable searches for responsive records. We request:
1. Confirmation of which specific systems/officers were searched
2. Verification that all officers present at the incident were queried
3. Confirmation of the date range searched

If records truly do not exist, please provide an explanation of why the incident was not recorded despite agency body camera policies.""",
    },
    DenialReason.other: {
        "statute": "Florida Statute § 119.01",
        "argument": """Florida's Public Records Act is based on a presumption of openness. Any denial must be specifically authorized by statute and narrowly construed.

The reason provided for denial does not appear to be supported by a valid statutory exemption. We request:
1. Specific citation to the Florida Statute authorizing the denial
2. Explanation of how our request falls within that exemption
3. Consideration of partial disclosure or redaction

Florida courts consistently favor disclosure over withholding when there is any doubt about the applicability of an exemption.""",
    },
}


def generate_appeal_text(
    original_request_text: str,
    case_number: str,
    agency_name: str,
    denial_reason: DenialReason,
    denial_explanation: Optional[str] = None,
    incident_description: Optional[str] = None,
) -> str:
    """Generate an appeal letter for a denied FOIA request.

    Args:
        original_request_text: The original FOIA request text
        case_number: Original FOIA case number
        agency_name: Name of agency that denied request
        denial_reason: Reason for denial
        denial_explanation: Agency's explanation (if provided)
        incident_description: Description of incident

    Returns:
        Formatted appeal letter text
    """
    denial_info = APPEAL_ARGUMENTS.get(denial_reason, APPEAL_ARGUMENTS[DenialReason.other])

    denial_context = ""
    if denial_explanation:
        denial_context = f"""
The agency stated: "{denial_explanation}"
"""

    incident_context = ""
    if incident_description:
        incident_context = f"regarding {incident_description} "

    appeal_date = datetime.now(timezone.utc).strftime("%B %d, %Y")

    return f"""Dear Agency Counsel,

RE: Appeal of Public Records Request Denial
Original Case Number: {case_number}
Date of Appeal: {appeal_date}

I am writing to formally appeal the denial of my public records request {incident_context}submitted under Florida's Public Records Act, Chapter 119, Florida Statutes.
{denial_context}

LEGAL BASIS FOR APPEAL

{denial_info['argument']}

GOVERNING LAW

Florida's Public Records Act is founded on the principle that government transparency is essential to democracy. Florida Statute § 119.01(1) declares that "it is the policy of this state that all state, county, and municipal records are open for personal inspection and copying by any person."

The Florida Supreme Court has repeatedly held that exemptions to the Public Records Act must be narrowly construed, with any doubt resolved in favor of disclosure. See Shevin v. Byron, Harless, Schaffer, Reid & Assoc., Inc., 379 So. 2d 633 (Fla. 1980).

REQUESTED ACTION

I respectfully request that {agency_name} reconsider its denial and:

1. Release the requested records in full, or
2. Provide a detailed, record-by-record explanation of specific statutory exemptions, or
3. Release redacted versions with exempt portions clearly identified

If the agency maintains its denial, I request a written response that:
- Cites specific statutory authority for each exemption claimed
- Explains how each responsive record falls within the exemption
- Indicates the volume of records being withheld
- Provides a timeframe for further appeal to the State Attorney or court

ORIGINAL REQUEST

For reference, my original request stated:

{original_request_text}

TIME SENSITIVITY

Delays in releasing public records undermine government accountability. I request a response to this appeal within 10 business days as contemplated by Florida law.

Thank you for your reconsideration. I remain willing to work with the agency to narrow the request or accept redactions if that would facilitate compliance with Florida's Public Records Act.

Sincerely,

FOIAPIPE Automated Appeal System
On behalf of: Public Records Requester

---

NOTICE: Failure to respond to this appeal may result in a complaint to the State Attorney's Office under Florida Statute § 119.11 or civil action under Florida Statute § 119.12. The prevailing party in such actions is entitled to attorney's fees and costs.
"""


def generate_appeal_pdf(appeal_text: str, case_number: str, appeal_number: str) -> bytes:
    """Generate a formatted PDF of the appeal letter.

    Args:
        appeal_text: The appeal letter text
        case_number: Original FOIA case number
        appeal_number: Appeal case number

    Returns:
        PDF file as bytes
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        "AppealHeader",
        parent=styles["Heading1"],
        fontSize=14,
        spaceAfter=6,
        textColor="#CC0000",  # Red to indicate appeal
    )

    ref_style = ParagraphStyle(
        "AppealRef",
        parent=styles["Normal"],
        fontSize=10,
        textColor="grey",
        spaceAfter=20,
    )

    body_style = ParagraphStyle(
        "AppealBody",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        spaceAfter=12,
    )

    story = []
    story.append(Paragraph("APPEAL OF PUBLIC RECORDS REQUEST DENIAL", header_style))
    story.append(
        Paragraph(
            f"Original Case: {case_number} | Appeal: {appeal_number}",
            ref_style,
        )
    )
    story.append(Spacer(1, 12))

    # Split into paragraphs
    for paragraph in appeal_text.split("\n\n"):
        paragraph = paragraph.strip()
        if paragraph:
            # Handle line breaks within paragraphs
            para_text = paragraph.replace("\n", "<br/>")
            story.append(Paragraph(para_text, body_style))
            story.append(Spacer(1, 6))

    story.append(Spacer(1, 24))
    story.append(
        Paragraph(
            f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}",
            ParagraphStyle(
                "AppealFooter",
                parent=styles["Normal"],
                fontSize=8,
                textColor="grey",
            ),
        )
    )

    doc.build(story)
    return buffer.getvalue()


def get_appeal_recommendations(denial_reason: DenialReason) -> dict:
    """Get recommendations for appealing a specific denial reason.

    Args:
        denial_reason: The reason given for denial

    Returns:
        Dict with success_rate, strategy, and next_steps
    """
    recommendations = {
        DenialReason.active_investigation: {
            "success_rate": "Moderate (40-60%)",
            "strategy": "Request partial release of non-investigative portions",
            "next_steps": [
                "Ask for specific timeline when records will be available",
                "Request redacted version with exempt portions marked",
                "Cite cases where similar footage was released",
            ],
            "timeline": "May take 30-90 days if investigation is truly active",
        },
        DenialReason.public_safety: {
            "success_rate": "Low (20-40%)",
            "strategy": "Challenge vague safety claims, offer redaction",
            "next_steps": [
                "Request specific safety concerns in writing",
                "Offer to accept redacted/blurred footage",
                "Point out that incident is already public knowledge",
            ],
            "timeline": "10-30 days for agency response",
        },
        DenialReason.privacy: {
            "success_rate": "High (60-80%)",
            "strategy": "Accept redaction of faces/identifying info",
            "next_steps": [
                "Explicitly agree to redaction in appeal",
                "Cite cases allowing redacted release",
                "Note that incident occurred in public space",
            ],
            "timeline": "10-20 days if agency agrees to redact",
        },
        DenialReason.excessive_cost: {
            "success_rate": "High (70-90%)",
            "strategy": "Narrow request or pay estimated cost",
            "next_steps": [
                "Request itemized cost breakdown",
                "Offer to pay reasonable costs",
                "Narrow to specific time windows if needed",
            ],
            "timeline": "5-15 days once payment terms agreed",
        },
        DenialReason.vague_request: {
            "success_rate": "Very High (80-95%)",
            "strategy": "Provide additional details, clarify scope",
            "next_steps": [
                "Add specific times, locations, officer names",
                "Reference incident report number if available",
                "Offer to discuss scope with records custodian",
            ],
            "timeline": "5-10 days after clarification",
        },
        DenialReason.no_records: {
            "success_rate": "Low (10-30%)",
            "strategy": "Challenge completeness of search",
            "next_steps": [
                "Request details on search performed",
                "Ask why body cameras were not activated",
                "File complaint if policy was violated",
            ],
            "timeline": "Varies widely; may require investigation",
        },
        DenialReason.other: {
            "success_rate": "Unknown",
            "strategy": "Request specific statutory citation",
            "next_steps": [
                "Ask for exact Florida Statute claimed as exemption",
                "Research validity of claimed exemption",
                "Consider consulting attorney if claim seems invalid",
            ],
            "timeline": "10-30 days depending on complexity",
        },
    }

    return recommendations.get(denial_reason, recommendations[DenialReason.other])
