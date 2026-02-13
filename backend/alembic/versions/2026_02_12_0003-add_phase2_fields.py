"""Add Phase 2 fields: article prioritization + video transcripts + agency report cards

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-12 00:03:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 2A: Article prioritization fields
    op.add_column('news_articles', sa.Column('predicted_revenue', sa.Numeric(10, 2), nullable=True))
    op.add_column('news_articles', sa.Column('priority_factors', JSONB(), nullable=True))
    op.create_index('ix_news_articles_predicted_revenue', 'news_articles', ['predicted_revenue'])

    # Phase 2B: Video transcript fields
    op.add_column('videos', sa.Column('transcript_text', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('transcript_segments', JSONB(), nullable=True))

    # Phase 4B: Agency report card fields
    op.add_column('agencies', sa.Column('report_card_grade', sa.String(2), nullable=True))
    op.add_column('agencies', sa.Column('report_card_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('agencies', 'report_card_updated_at')
    op.drop_column('agencies', 'report_card_grade')
    op.drop_column('videos', 'transcript_segments')
    op.drop_column('videos', 'transcript_text')
    op.drop_index('ix_news_articles_predicted_revenue', table_name='news_articles')
    op.drop_column('news_articles', 'priority_factors')
    op.drop_column('news_articles', 'predicted_revenue')
