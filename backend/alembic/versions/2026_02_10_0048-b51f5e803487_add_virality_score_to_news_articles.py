"""Add virality_score to news_articles

Revision ID: b51f5e803487
Revises: 7f2d9b4e3c8a
Create Date: 2026-02-10 00:48:33.156443+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b51f5e803487'
down_revision: Union[str, None] = '7f2d9b4e3c8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add virality_score column to news_articles
    op.add_column('news_articles', sa.Column('virality_score', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_news_articles_virality_score'), 'news_articles', ['virality_score'], unique=False)


def downgrade() -> None:
    # Remove virality_score column from news_articles
    op.drop_index(op.f('ix_news_articles_virality_score'), table_name='news_articles')
    op.drop_column('news_articles', 'virality_score')
