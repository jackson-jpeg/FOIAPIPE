"""Add missing performance indexes

Revision ID: add_missing_performance_indexes
Revises: add_video_subtitles_table
Create Date: 2026-02-10 06:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_missing_performance_indexes'
down_revision = 'add_video_subtitles_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add index on NewsArticle.detected_agency for join performance
    op.create_index(
        'ix_news_articles_detected_agency',
        'news_articles',
        ['detected_agency']
    )

    # Add index on FoiaRequest.agency_reference_number for lookups
    op.create_index(
        'ix_foia_requests_agency_reference_number',
        'foia_requests',
        ['agency_reference_number']
    )

    # Add index on Video.youtube_video_id for YouTube operations
    op.create_index(
        'ix_videos_youtube_video_id',
        'videos',
        ['youtube_video_id']
    )


def downgrade() -> None:
    op.drop_index('ix_videos_youtube_video_id', table_name='videos')
    op.drop_index('ix_foia_requests_agency_reference_number', table_name='foia_requests')
    op.drop_index('ix_news_articles_detected_agency', table_name='news_articles')
