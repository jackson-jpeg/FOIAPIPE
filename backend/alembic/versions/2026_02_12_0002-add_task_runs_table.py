"""Add task_runs table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-12 00:02:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'task_runs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('task_name', sa.String(200), nullable=False, index=True),
        sa.Column('celery_task_id', sa.String(200), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('status', sa.Enum('success', 'failure', 'timeout', 'started', name='task_run_status'), nullable=False, server_default='started'),
        sa.Column('result_summary', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_task_runs_started_at', 'task_runs', ['started_at'])


def downgrade() -> None:
    op.drop_index('ix_task_runs_started_at', table_name='task_runs')
    op.drop_table('task_runs')
    op.execute("DROP TYPE IF EXISTS task_run_status")
