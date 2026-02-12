"""Agencies router – full CRUD for law enforcement agencies."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.agency import Agency
from app.models.agency_contact import AgencyContact
from app.schemas.agency import AgencyCreate, AgencyList, AgencyResponse, AgencyUpdate
from app.schemas.agency_contact import (
    AgencyContactCreate,
    AgencyContactList,
    AgencyContactResponse,
    AgencyContactUpdate,
)

router = APIRouter(prefix="/api/agencies", tags=["agencies"])


@router.get("", response_model=AgencyList)
async def list_agencies(
    search: str | None = Query(None, description="Filter by name or abbreviation"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyList:
    """Return all agencies, with optional search filter."""
    stmt = select(Agency).order_by(Agency.name)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Agency.name.ilike(pattern) | Agency.abbreviation.ilike(pattern)
        )

    result = await db.execute(stmt)
    agencies = result.scalars().all()

    count_stmt = select(func.count(Agency.id))
    if search:
        pattern = f"%{search}%"
        count_stmt = count_stmt.where(
            Agency.name.ilike(pattern) | Agency.abbreviation.ilike(pattern)
        )
    total = (await db.execute(count_stmt)).scalar_one()

    return AgencyList(
        items=[AgencyResponse.model_validate(a) for a in agencies],
        total=total,
    )


@router.get("/{agency_id}", response_model=AgencyResponse)
async def get_agency(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyResponse:
    """Return a single agency by ID."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )
    return AgencyResponse.model_validate(agency)


@router.post("", response_model=AgencyResponse, status_code=status.HTTP_201_CREATED)
async def create_agency(
    body: AgencyCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyResponse:
    """Create a new agency."""
    agency = Agency(**body.model_dump())
    db.add(agency)
    await db.flush()
    await db.refresh(agency)
    return AgencyResponse.model_validate(agency)


@router.put("/{agency_id}", response_model=AgencyResponse)
async def update_agency(
    agency_id: uuid.UUID,
    body: AgencyUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyResponse:
    """Update an existing agency."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agency, field, value)
    await db.flush()
    await db.refresh(agency)
    return AgencyResponse.model_validate(agency)


@router.get("/{agency_id}/template")
async def get_agency_template(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Get the FOIA request template for an agency.

    Returns the custom template if set, otherwise returns the default template.
    """
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )

    # Default template
    default_template = """Dear Records Custodian,

Pursuant to Florida's Public Records Act, Chapter 119, Florida Statutes, I am requesting copies of the following records:

All body-worn camera footage, dashboard camera footage, and any other audio/video recordings related to {incident_description} on {incident_date} at {incident_location} involving {agency_name}.

I am willing to pay reasonable duplication costs. Please notify me if costs will exceed $25.00 before proceeding.

Please provide responsive records in electronic format where available.

Thank you for your prompt attention to this request.

Sincerely,
FOIA Archive Automated Request System"""

    return {
        "agency_id": str(agency.id),
        "agency_name": agency.name,
        "template": agency.foia_template or default_template,
        "is_custom": agency.foia_template is not None,
        "placeholders": [
            "{incident_description}",
            "{incident_date}",
            "{incident_location}",
            "{agency_name}",
            "{officer_names}",
            "{case_numbers}",
        ],
    }


@router.put("/{agency_id}/template")
async def update_agency_template(
    agency_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Update the FOIA request template for an agency.

    Body should contain:
    - template: The template string with placeholders
    """
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )

    template = body.get("template")
    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template is required",
        )

    # Validate template has required placeholders
    required_placeholders = ["{incident_description}", "{agency_name}"]
    missing = [p for p in required_placeholders if p not in template]

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template is missing required placeholders: {', '.join(missing)}",
        )

    agency.foia_template = template
    await db.flush()
    await db.refresh(agency)

    return {
        "success": True,
        "message": f"Template updated for {agency.name}",
        "agency_id": str(agency.id),
    }


@router.delete("/{agency_id}/template")
async def delete_agency_template(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Delete the custom FOIA template for an agency (revert to default)."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )

    agency.foia_template = None
    await db.flush()

    return {
        "success": True,
        "message": f"Template reset to default for {agency.name}",
        "agency_id": str(agency.id),
    }


# ── Agency Contacts ──────────────────────────────────────────────────────


@router.get("/{agency_id}/contacts", response_model=AgencyContactList)
async def list_agency_contacts(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyContactList:
    """List all contacts for an agency."""
    # Verify agency exists
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )

    # Get contacts
    result = await db.execute(
        select(AgencyContact)
        .where(AgencyContact.agency_id == agency_id)
        .order_by(AgencyContact.is_primary.desc(), AgencyContact.name)
    )
    contacts = result.scalars().all()

    return AgencyContactList(
        items=[AgencyContactResponse.model_validate(c) for c in contacts],
        total=len(contacts),
    )


@router.post("/{agency_id}/contacts", response_model=AgencyContactResponse, status_code=status.HTTP_201_CREATED)
async def create_agency_contact(
    agency_id: uuid.UUID,
    body: AgencyContactCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyContactResponse:
    """Create a new contact for an agency."""
    # Verify agency exists
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )

    # If setting as primary, unset other primary contacts
    if body.is_primary:
        await db.execute(
            select(AgencyContact)
            .where(AgencyContact.agency_id == agency_id)
            .where(AgencyContact.is_primary == True)
        )
        primary_contacts = (await db.execute(
            select(AgencyContact)
            .where(AgencyContact.agency_id == agency_id)
            .where(AgencyContact.is_primary == True)
        )).scalars().all()

        for contact in primary_contacts:
            contact.is_primary = False

    # Create contact
    contact = AgencyContact(
        agency_id=agency_id,
        **body.model_dump(),
    )
    db.add(contact)
    await db.flush()
    await db.refresh(contact)

    return AgencyContactResponse.model_validate(contact)


@router.get("/{agency_id}/contacts/{contact_id}", response_model=AgencyContactResponse)
async def get_agency_contact(
    agency_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyContactResponse:
    """Get a specific contact for an agency."""
    contact = await db.get(AgencyContact, contact_id)
    if not contact or contact.agency_id != str(agency_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )

    return AgencyContactResponse.model_validate(contact)


@router.put("/{agency_id}/contacts/{contact_id}", response_model=AgencyContactResponse)
async def update_agency_contact(
    agency_id: uuid.UUID,
    contact_id: uuid.UUID,
    body: AgencyContactUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyContactResponse:
    """Update a contact for an agency."""
    contact = await db.get(AgencyContact, contact_id)
    if not contact or contact.agency_id != str(agency_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )

    # If setting as primary, unset other primary contacts
    if body.is_primary:
        primary_contacts = (await db.execute(
            select(AgencyContact)
            .where(AgencyContact.agency_id == agency_id)
            .where(AgencyContact.is_primary == True)
            .where(AgencyContact.id != contact_id)
        )).scalars().all()

        for other_contact in primary_contacts:
            other_contact.is_primary = False

    # Update contact
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.flush()
    await db.refresh(contact)

    return AgencyContactResponse.model_validate(contact)


@router.delete("/{agency_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_agency_contact(
    agency_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> None:
    """Delete a contact from an agency."""
    contact = await db.get(AgencyContact, contact_id)
    if not contact or contact.agency_id != str(agency_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )

    await db.delete(contact)
    await db.flush()


# ── Agency Deletion ───────────────────────────────────────────────────────


@router.delete("/{agency_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_agency(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> None:
    """Delete an agency by ID."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )
    await db.delete(agency)
    await db.flush()
