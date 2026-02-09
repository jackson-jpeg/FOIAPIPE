"""Unit tests for the FOIA generator service."""

import re

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.foia_request import FoiaRequest, FoiaStatus
from app.services.foia_generator import (
    assign_case_number,
    generate_pdf,
    generate_request_text,
)


@pytest.mark.asyncio
async def test_assign_case_number_format(db_session: AsyncSession):
    """Case numbers follow FOIA-YYYY-NNNN format."""
    case_number = await assign_case_number(db_session)
    assert re.match(r"^FOIA-\d{4}-\d{4}$", case_number)


@pytest.mark.asyncio
async def test_case_number_sequential(db_session: AsyncSession):
    """Sequential calls produce incrementing case numbers."""
    cn1 = await assign_case_number(db_session)
    # Seed a record so the next call sees count=1
    agency = Agency(name="Test Agency", state="FL")
    db_session.add(agency)
    await db_session.flush()

    foia = FoiaRequest(
        case_number=cn1,
        agency_id=agency.id,
        status=FoiaStatus.draft,
        request_text="test",
    )
    db_session.add(foia)
    await db_session.flush()

    cn2 = await assign_case_number(db_session)
    # Extract sequence numbers
    seq1 = int(cn1.split("-")[-1])
    seq2 = int(cn2.split("-")[-1])
    assert seq2 == seq1 + 1


def test_generate_request_text_full():
    """All fields populated produces complete request text."""
    text = generate_request_text(
        incident_description="shooting incident",
        incident_date="January 15, 2026",
        incident_location="100 Main St, Tampa",
        agency_name="Tampa Police Department",
        officer_names=["Officer Smith", "Officer Jones"],
        case_numbers=["2026-001"],
    )
    assert "Chapter 119" in text
    assert "shooting incident" in text
    assert "January 15, 2026" in text
    assert "100 Main St, Tampa" in text
    assert "Tampa Police Department" in text
    assert "Officer Smith" in text
    assert "Officer Jones" in text
    assert "2026-001" in text


def test_generate_request_text_minimal():
    """Only required fields still produces valid request text."""
    text = generate_request_text(
        incident_description="the referenced incident",
        agency_name="Hillsborough County SO",
    )
    assert "Chapter 119" in text
    assert "the referenced incident" in text
    assert "Hillsborough County SO" in text
    assert "the referenced date" in text
    assert "the referenced location" in text
    # Should not contain officer or case sections
    assert "officers:" not in text.lower() or "the following officers" not in text
    assert "Reference case" not in text


def test_generate_request_text_with_officers():
    """Officer names are included in the request body."""
    text = generate_request_text(
        incident_description="use of force",
        agency_name="St. Pete PD",
        officer_names=["Sgt. Adams", "Cpl. Baker"],
    )
    assert "Sgt. Adams" in text
    assert "Cpl. Baker" in text
    assert "officers" in text.lower()


def test_generate_pdf_returns_bytes():
    """PDF generation returns bytes starting with %PDF- header."""
    pdf = generate_pdf("Test FOIA request text.", "FOIA-2026-0001")
    assert isinstance(pdf, bytes)
    assert pdf[:5] == b"%PDF-"
    assert len(pdf) > 100  # Sanity: not empty
