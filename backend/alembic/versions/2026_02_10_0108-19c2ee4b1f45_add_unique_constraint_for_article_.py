"""Add unique constraint for article-agency FOIA idempotency

Revision ID: 19c2ee4b1f45
Revises: 35f94b085efd
Create Date: 2026-02-10 01:08:07.368236+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '19c2ee4b1f45'
down_revision: Union[str, None] = '35f94b085efd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add partial unique index to prevent duplicate FOIA requests for the same article-agency pair
    # Only applies when news_article_id is NOT NULL (manual requests without articles can still have duplicates)
    op.create_index(
        'ix_foia_requests_article_agency_unique',
        'foia_requests',
        ['news_article_id', 'agency_id'],
        unique=True,
        postgresql_where=sa.text('news_article_id IS NOT NULL')
    )


def downgrade() -> None:
    # Remove the unique index
    op.drop_index('ix_foia_requests_article_agency_unique', table_name='foia_requests')
