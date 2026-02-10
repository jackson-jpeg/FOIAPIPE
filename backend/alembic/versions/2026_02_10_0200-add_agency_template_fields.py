"""Add agency FOIA template and cost fields

Revision ID: add_agency_template_fields
Revises: 19c2ee4b1f45
Create Date: 2026-02-10 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_agency_template_fields'
down_revision = '19c2ee4b1f45'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add foia_template field for customizable request templates
    op.add_column('agencies', sa.Column('foia_template', sa.Text(), nullable=True))

    # Add typical_cost_per_hour for cost prediction
    op.add_column('agencies', sa.Column('typical_cost_per_hour', sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('agencies', 'typical_cost_per_hour')
    op.drop_column('agencies', 'foia_template')
