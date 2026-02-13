"""merge heads

Revision ID: ea30f9a20376
Revises: c3d4e5f6a7b8, add_video_scheduled_at
Create Date: 2026-02-13 04:57:29.761895+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea30f9a20376'
down_revision: Union[str, None] = ('c3d4e5f6a7b8', 'add_video_scheduled_at')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
