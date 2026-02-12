"""Add video scheduled_at column and scheduled status

Revision ID: add_video_scheduled_at
Revises: add_missing_performance_indexes
Create Date: 2026-02-12 01:00:00.000000

"""
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_video_scheduled_at'
down_revision = 'add_missing_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'scheduled' to the video_status_enum
    op.execute("ALTER TYPE video_status_enum ADD VALUE IF NOT EXISTS 'scheduled'")

    # Add scheduled_at column
    op.add_column('videos', sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True))

    # Add index for efficient scheduled video queries
    op.create_index('ix_videos_scheduled_at', 'videos', ['scheduled_at'])


def downgrade() -> None:
    op.drop_index('ix_videos_scheduled_at', table_name='videos')
    op.drop_column('videos', 'scheduled_at')
    # Note: PostgreSQL does not support removing enum values
