"""Add news_source_health table for circuit breakers

Revision ID: 35f94b085efd
Revises: b51f5e803487
Create Date: 2026-02-10 01:04:36.266251+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '35f94b085efd'
down_revision: Union[str, None] = 'b51f5e803487'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create news_source_health table
    op.create_table(
        'news_source_health',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('source_name', sa.String(length=200), nullable=False),
        sa.Column('source_url', sa.String(length=1000), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_circuit_open', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('consecutive_failures', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_failures', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_successes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_failure_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('circuit_opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('circuit_retry_after', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_name')
    )
    op.create_index(op.f('ix_news_source_health_source_name'), 'news_source_health', ['source_name'], unique=False)


def downgrade() -> None:
    # Drop news_source_health table
    op.drop_index(op.f('ix_news_source_health_source_name'), table_name='news_source_health')
    op.drop_table('news_source_health')
