"""Add news_sources table

Revision ID: a1b2c3d4e5f6
Revises: b51f5e803487
Create Date: 2026-02-12 00:01:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b51f5e803487'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'news_sources',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False, unique=True),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('source_type', sa.Enum('rss', 'web_scrape', name='source_type'), nullable=False, server_default='rss'),
        sa.Column('selectors', JSONB(), nullable=True),
        sa.Column('scan_interval_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_scanned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_news_sources_source_type'), 'news_sources', ['source_type'])
    op.create_index(op.f('ix_news_sources_is_active'), 'news_sources', ['is_active'])

    # Seed with current hardcoded feeds
    from uuid_extensions import uuid7
    news_sources = op.get_bind()

    rss_feeds = [
        ("WFLA", "https://www.wfla.com/news/crime/feed/", "rss"),
        ("WFLA Local", "https://www.wfla.com/news/local-news/feed/", "rss"),
        ("Fox 13", "https://www.fox13news.com/rss/category/local-news", "rss"),
        ("ABC Action News", "https://www.abcactionnews.com/news/crime.rss", "rss"),
        ("ABC Action News Local", "https://www.abcactionnews.com/news/local-news.rss", "rss"),
        (
            "Google News",
            "https://news.google.com/rss/search?q=Tampa+Bay+police+%22officer-involved%22+OR+%22shooting%22+OR+%22arrest%22+OR+%22bodycam%22+OR+%22use+of+force%22&hl=en-US&gl=US&ceid=US:en",
            "rss",
        ),
        ("10 Tampa Bay / WTSP", "https://www.wtsp.com/feeds/syndication/rss/news/local", "rss"),
        ("Bay News 9", "https://www.baynews9.com/fl/tampa/news.rss", "rss"),
        ("WFTS Tampa Bay", "https://www.wfts.com/news/local-news.rss", "rss"),
    ]

    web_sources = [
        (
            "Tampa Bay Times",
            "https://www.tampabay.com/news/crime/",
            "web_scrape",
            {"selectors": ["h2.StoryCard_headline a", "h3.PromoCard_headline a"]},
        ),
        (
            "Spectrum News / Bay News 9",
            "https://spectrumlocalnews.com/fl/tampa",
            "web_scrape",
            {"selectors": ["a.heading", "h3 a", "a[data-testid='story-card-link']"]},
        ),
    ]

    for name, url, stype in rss_feeds:
        news_sources.execute(
            sa.text(
                "INSERT INTO news_sources (id, name, url, source_type, scan_interval_minutes, is_active, error_count, created_at) "
                "VALUES (:id, :name, :url, :source_type, :interval, true, 0, NOW())"
            ),
            {"id": str(uuid7()), "name": name, "url": url, "source_type": stype, "interval": 30},
        )

    for name, url, stype, selectors in web_sources:
        import json
        news_sources.execute(
            sa.text(
                "INSERT INTO news_sources (id, name, url, source_type, selectors, scan_interval_minutes, is_active, error_count, created_at) "
                "VALUES (:id, :name, :url, :source_type, :selectors, :interval, true, 0, NOW())"
            ),
            {"id": str(uuid7()), "name": name, "url": url, "source_type": stype, "selectors": json.dumps(selectors), "interval": 60},
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_news_sources_is_active'), table_name='news_sources')
    op.drop_index(op.f('ix_news_sources_source_type'), table_name='news_sources')
    op.drop_table('news_sources')
    op.execute("DROP TYPE IF EXISTS source_type")
