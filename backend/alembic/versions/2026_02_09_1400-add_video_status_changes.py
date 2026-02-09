"""add video_status_changes audit table

Revision ID: 7f2d9b4e3c8a
Revises: 9a8e4c2b1f3d
Create Date: 2026-02-09 14:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7f2d9b4e3c8a'
down_revision: Union[str, None] = '9a8e4c2b1f3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create video_status_changes audit table
    op.create_table(
        'video_status_changes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('video_id', sa.UUID(), nullable=False),
        sa.Column('from_status', sa.String(length=50), nullable=False),
        sa.Column('to_status', sa.String(length=50), nullable=False),
        sa.Column('changed_by', sa.String(length=100), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['video_id'], ['videos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index for efficient lookups
    op.create_index(
        'ix_video_status_changes_video_id',
        'video_status_changes',
        ['video_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_video_status_changes_video_id', table_name='video_status_changes')
    op.drop_table('video_status_changes')
