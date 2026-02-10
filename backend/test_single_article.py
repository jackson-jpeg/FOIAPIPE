#!/usr/bin/env python3
"""Test specific article filtering."""

import sys
sys.path.insert(0, "/Users/jackson/FOIAPIPE/backend")

from app.services.article_classifier import is_article_relevant

# Test the problematic article
headline = "3 tourists gunned down at Florida rental home; suspect charged"
summary = ""

is_relevant, reason = is_article_relevant(headline, summary)

print(f"Headline: {headline}")
print(f"Relevant: {is_relevant}")
print(f"Reason: {reason}")

# Debug - check what keywords match
combined = headline.lower()
print(f"\nDebug info:")
print(f"Contains 'gunned': {'gunned' in combined}")
print(f"Contains 'charged': {'charged' in combined}")
