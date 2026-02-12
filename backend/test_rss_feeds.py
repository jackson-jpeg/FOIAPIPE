#!/usr/bin/env python3
"""Test script to validate RSS feeds and article filtering."""

import asyncio
import sys
from datetime import datetime

import feedparser
import httpx

# Import filtering logic
sys.path.insert(0, "/Users/jackson/FOIAPIPE/backend")
from app.services.article_classifier import is_article_relevant

RSS_FEEDS = [
    {"url": "https://www.wfla.com/news/crime/feed/", "source": "WFLA"},
    {"url": "https://www.wfla.com/news/local-news/feed/", "source": "WFLA Local"},
    {"url": "https://www.fox13news.com/rss/category/local-news", "source": "Fox 13"},
    {"url": "https://www.abcactionnews.com/news/crime.rss", "source": "ABC Action News"},
    {"url": "https://www.abcactionnews.com/news/local-news.rss", "source": "ABC Action News Local"},
]


async def test_feed(feed_url: str, source_name: str) -> dict:
    """Test a single RSS feed."""
    print(f"\n{'='*80}")
    print(f"Testing: {source_name}")
    print(f"URL: {feed_url}")
    print(f"{'='*80}")

    stats = {
        "source": source_name,
        "url": feed_url,
        "reachable": False,
        "found": 0,
        "relevant": 0,
        "filtered": 0,
        "error": None,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                feed_url,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; FOIAArchive/1.0)"},
            )
            response.raise_for_status()

        stats["reachable"] = True
        feed = feedparser.parse(response.text)
        stats["found"] = len(feed.entries)

        print(f"✅ Feed reachable - found {len(feed.entries)} articles")

        # Test first 5 articles for relevance
        for i, entry in enumerate(feed.entries[:5]):
            headline = entry.get("title", "")
            summary = entry.get("summary", "")

            is_relevant, reason = is_article_relevant(headline, summary)

            if is_relevant:
                stats["relevant"] += 1
                print(f"  ✅ [{i+1}] RELEVANT: {headline[:60]}...")
            else:
                stats["filtered"] += 1
                print(f"  ❌ [{i+1}] FILTERED ({reason}): {headline[:60]}...")

        print(f"\nSummary: {stats['relevant']} relevant, {stats['filtered']} filtered out of {min(5, len(feed.entries))} tested")

    except Exception as e:
        stats["error"] = str(e)
        print(f"❌ ERROR: {e}")

    return stats


async def main():
    """Test all RSS feeds."""
    print("\n" + "="*80)
    print("FOIA Archive RSS FEED VALIDATION")
    print(f"Test started: {datetime.now().isoformat()}")
    print("="*80)

    all_stats = []
    for feed in RSS_FEEDS:
        stats = await test_feed(feed["url"], feed["source"])
        all_stats.append(stats)
        await asyncio.sleep(2)  # Be polite

    # Summary report
    print("\n\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)

    reachable_count = sum(1 for s in all_stats if s["reachable"])
    total_found = sum(s["found"] for s in all_stats)
    total_relevant = sum(s["relevant"] for s in all_stats)
    total_filtered = sum(s["filtered"] for s in all_stats)

    print(f"\nFeeds tested: {len(RSS_FEEDS)}")
    print(f"Feeds reachable: {reachable_count}/{len(RSS_FEEDS)}")
    print(f"Total articles found: {total_found}")
    print(f"Sample articles relevant: {total_relevant}")
    print(f"Sample articles filtered: {total_filtered}")

    if total_relevant + total_filtered > 0:
        relevance_rate = (total_relevant / (total_relevant + total_filtered)) * 100
        print(f"Relevance rate: {relevance_rate:.1f}%")

    print("\nPer-source breakdown:")
    for stats in all_stats:
        status = "✅" if stats["reachable"] else "❌"
        print(f"  {status} {stats['source']}: {stats['found']} articles, {stats['relevant']} relevant")
        if stats["error"]:
            print(f"      Error: {stats['error']}")

    print("\n" + "="*80)


if __name__ == "__main__":
    asyncio.run(main())
