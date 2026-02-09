"""add foia_status_changes audit table

Revision ID: 9a8e4c2b1f3d
Revises: db74a32f37a1
Create Date: 2026-02-09 12:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9a8e4c2b1f3d'
down_revision: Union[str, None] = 'db74a32f37a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create foia_status_changes audit table
    op.create_table(
        'foia_status_changes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('foia_request_id', sa.UUID(), nullable=False),
        sa.Column('from_status', sa.String(length=50), nullable=False),
        sa.Column('to_status', sa.String(length=50), nullable=False),
        sa.Column('changed_by', sa.String(length=100), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['foia_request_id'], ['foia_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index for efficient lookups
    op.create_index(
        'ix_foia_status_changes_foia_request_id',
        'foia_status_changes',
        ['foia_request_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_foia_status_changes_foia_request_id', table_name='foia_status_changes')
    op.drop_table('foia_status_changes')
