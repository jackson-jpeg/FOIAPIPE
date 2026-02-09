"""Generate FOIA request text and PDFs for Florida public records requests."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.foia_request import FoiaRequest


async def assign_case_number(db: AsyncSession) -> str:
    """Generate sequential FOIA-YYYY-NNNN case number."""
    year = datetime.now(timezone.utc).year
    prefix = f"FOIA-{year}-"
    result = await db.execute(
        select(func.count(FoiaRequest.id)).where(
            FoiaRequest.case_number.like(f"{prefix}%")
        )
    )
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"


def generate_request_text(
    incident_description: str,
    incident_date: Optional[str] = None,
    incident_location: Optional[str] = None,
    agency_name: str = "",
    officer_names: Optional[list[str]] = None,
    case_numbers: Optional[list[str]] = None,
) -> str:
    """Populate the FOIA request template with incident details."""
    officer_section = ""
    if officer_names:
        names = ", ".join(officer_names)
        officer_section = f"\nSpecifically, records involving the following officers: {names}.\n"

    case_section = ""
    if case_numbers:
        nums = ", ".join(case_numbers)
        case_section = f"\nReference case number(s): {nums}.\n"

    date_str = incident_date or "the referenced date"
    location_str = incident_location or "the referenced location"

    return f"""Dear Records Custodian,

Pursuant to Florida's Public Records Act, Chapter 119, Florida Statutes, I am requesting copies of the following records:

All body-worn camera footage, dashboard camera footage, and any other audio/video recordings related to {incident_description} on {date_str} at {location_str} involving {agency_name}.
{officer_section}{case_section}
I am willing to pay reasonable duplication costs. Please notify me if costs will exceed $25.00 before proceeding.

Please provide responsive records in electronic format where available.

Thank you for your prompt attention to this request.

Sincerely,
FOIAPIPE Automated Request System"""


def generate_pdf(request_text: str, case_number: str) -> bytes:
    """Generate a formatted PDF of the FOIA request. Returns PDF bytes."""
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
        "FOIAHeader",
        parent=styles["Heading1"],
        fontSize=14,
        spaceAfter=6,
    )
    ref_style = ParagraphStyle(
        "FOIARef",
        parent=styles["Normal"],
        fontSize=10,
        textColor="grey",
        spaceAfter=20,
    )
    body_style = ParagraphStyle(
        "FOIABody",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        spaceAfter=12,
    )

    story = []
    story.append(Paragraph("Florida Public Records Request", header_style))
    story.append(Paragraph(f"Reference: {case_number}", ref_style))
    story.append(Spacer(1, 12))

    for paragraph in request_text.split("\n\n"):
        paragraph = paragraph.strip()
        if paragraph:
            story.append(Paragraph(paragraph.replace("\n", "<br/>"), body_style))
            story.append(Spacer(1, 6))

    story.append(Spacer(1, 24))
    story.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y')}",
        ParagraphStyle("FOIAFooter", parent=styles["Normal"], fontSize=8, textColor="grey"),
    ))

    doc.build(story)
    return buffer.getvalue()
