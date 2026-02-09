"""Seed script – loads agencies.json into the database via async upsert."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory, engine
from app.models.agency import Agency

# Also import Base so all tables are registered
from app.models.base import Base

SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "agencies.json"


async def seed_agencies() -> None:
    """Load agencies from JSON, upserting by name."""
    with open(SEED_FILE, "r") as f:
        agencies_data: list[dict] = json.load(f)

    async with async_session_factory() as session:
        for entry in agencies_data:
            name = entry["name"]
            result = await session.execute(
                select(Agency).where(Agency.name == name)
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update existing agency with new values
                for field, value in entry.items():
                    setattr(existing, field, value)
                print(f"  Updated: {name}")
            else:
                agency = Agency(**entry)
                session.add(agency)
                print(f"  Created: {name}")

        await session.commit()
    print(f"\nSeeded {len(agencies_data)} agencies successfully.")


async def main() -> None:
    print("Seeding agencies...")
    await seed_agencies()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
