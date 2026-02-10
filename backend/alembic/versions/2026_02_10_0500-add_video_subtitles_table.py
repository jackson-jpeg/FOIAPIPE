"""Add video subtitles table

Revision ID: add_video_subtitles_table
Revises: add_audit_logs_table
Create Date: 2026-02-10 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_video_subtitles_table'
down_revision = 'add_audit_logs_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create video_subtitles table
    op.create_table(
        'video_subtitles',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('video_id', UUID(as_uuid=True), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False),
        sa.Column('format', sa.String(length=10), nullable=False),
        sa.Column('storage_key', sa.String(length=500), nullable=True),
        sa.Column('youtube_caption_id', sa.String(length=255), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('segment_count', sa.Integer(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['video_id'], ['videos.id'], ondelete='CASCADE'),
    )

    # Create indexes
    op.create_index('ix_video_subtitles_video_id', 'video_subtitles', ['video_id'])
    op.create_index('ix_video_subtitles_language', 'video_subtitles', ['language'])


def downgrade() -> None:
    op.drop_index('ix_video_subtitles_language', table_name='video_subtitles')
    op.drop_index('ix_video_subtitles_video_id', table_name='video_subtitles')
    op.drop_table('video_subtitles')
