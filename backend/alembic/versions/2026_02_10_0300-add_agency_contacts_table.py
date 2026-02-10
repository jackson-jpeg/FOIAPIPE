"""Add agency contacts table

Revision ID: add_agency_contacts_table
Revises: add_agency_template_fields
Create Date: 2026-02-10 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_agency_contacts_table'
down_revision = 'add_agency_template_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create agency_contacts table
    op.create_table(
        'agency_contacts',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('agency_id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('contact_type', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('extension', sa.String(length=20), nullable=True),
        sa.Column('office_hours', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], ondelete='CASCADE'),
    )

    # Create index on agency_id for faster lookups
    op.create_index('ix_agency_contacts_agency_id', 'agency_contacts', ['agency_id'])


def downgrade() -> None:
    op.drop_index('ix_agency_contacts_agency_id', table_name='agency_contacts')
    op.drop_table('agency_contacts')
