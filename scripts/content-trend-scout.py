#!/usr/bin/env python3
"""
content-trend-scout.py

Scrapes trending AI topics from Google Trends and Reddit, then POSTs
new trends to Mission Control. Runs on Athena every 4 hours.

Usage:
    python content-trend-scout.py
    python content-trend-scout.py --dry-run
"""

import sys
import os
import argparse
import logging
import json
import time
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------

def check_deps():
    missing = []
    try:
        import requests  # noqa: F401
    except ImportError:
        missing.append("requests")
    try:
        from pytrends.request import TrendReq  # noqa: F401
    except ImportError:
        missing.append("pytrends")
    if missing:
        print(f"[ERROR] Missing pip packages: {', '.join(missing)}")
        print(f"        Run: pip install {' '.join(missing)}")
        sys.exit(1)

check_deps()

import requests
from pytrends.request import TrendReq

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MISSION_CONTROL_URL = os.environ.get(
    "MISSION_CONTROL_URL", "https://mission-control-app-theta.vercel.app"
).rstrip("/")

TRENDS_ENDPOINT = f"{MISSION_CONTROL_URL}/api/content/trends"

GOOGLE_KEYWORD_GROUPS = [
    ["AI tools", "ChatGPT", "AI automation", "artificial intelligence"],
    ["make money with AI", "AI for business", "AI side hustle"],
    ["AI content creation", "AI for creators", "TikTok AI"],
]

REDDIT_SUBREDDITS = ["artificial", "ChatGPT", "AItools", "Entrepreneur"]
REDDIT_MIN_SCORE = 100
REDDIT_POST_LIMIT = 10

DEDUP_HOURS = 24
DEDUP_CHARS = 60

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; MissionControlScout/1.0; "
        "+https://mission-control-app-theta.vercel.app)"
    ),
    "Content-Type": "application/json",
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("trend-scout")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def normalize_topic(topic: str) -> str:
    return topic.strip().lower()[: DEDUP_CHARS]


def fetch_existing_trends() -> list[dict]:
    """Fetch all trends from Mission Control to use for deduplication."""
    try:
        resp = requests.get(TRENDS_ENDPOINT, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        # Handle both list responses and wrapped responses
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("trends", data.get("data", []))
        return []
    except Exception as exc:
        log.warning(f"Could not fetch existing trends for deduplication: {exc}")
        return []


def build_dedup_set(existing: list[dict]) -> set[str]:
    """
    Build a set of normalized topics that were posted within the last 24 hours.
    """
    cutoff = datetime.now(tz=timezone.utc).timestamp() - (DEDUP_HOURS * 3600)
    seen = set()
    for t in existing:
        # Try common timestamp field names
        ts_raw = t.get("created_at") or t.get("createdAt") or t.get("timestamp") or ""
        if ts_raw:
            try:
                # Handle ISO strings with or without timezone
                ts_raw_clean = ts_raw.replace("Z", "+00:00")
                ts = datetime.fromisoformat(ts_raw_clean).timestamp()
                if ts < cutoff:
                    continue
            except Exception:
                pass  # If we can't parse, assume it's recent (conservative)
        topic = t.get("topic", "")
        if topic:
            seen.add(normalize_topic(topic))
    return seen


def post_trend(trend: dict, dry_run: bool) -> bool:
    """POST a single trend to Mission Control. Returns True on success."""
    if dry_run:
        log.info(
            f"[DRY-RUN] Would POST trend: {trend['topic']!r} "
            f"(score={trend['trend_score']}, platform={trend['platform']})"
        )
        return True
    try:
        resp = requests.post(
            TRENDS_ENDPOINT,
            headers=HEADERS,
            json=trend,
            timeout=15,
        )
        resp.raise_for_status()
        log.info(f"Posted trend: {trend['topic']!r} (score={trend['trend_score']})")
        return True
    except requests.HTTPError as exc:
        log.error(f"HTTP error posting trend {trend['topic']!r}: {exc} — {exc.response.text[:200]}")
        return False
    except Exception as exc:
        log.error(f"Error posting trend {trend['topic']!r}: {exc}")
        return False


# ---------------------------------------------------------------------------
# Google Trends
# ---------------------------------------------------------------------------


def fetch_google_trends() -> list[dict]:
    """Fetch rising queries for each keyword group via pytrends."""
    trends = []
    try:
        pytrends = TrendReq(hl="en-US", tz=300, timeout=(10, 30))
    except Exception as exc:
        log.error(f"Failed to initialize pytrends: {exc}")
        return trends

    for group in GOOGLE_KEYWORD_GROUPS:
        try:
            log.info(f"Google Trends: querying group {group}")
            pytrends.build_payload(
                group,
                cat=0,
                timeframe="now 7-d",
                geo="US",
                gprop="",
            )
            # Small delay to be polite
            time.sleep(1)
            related = pytrends.related_queries()
            for keyword in group:
                kw_data = related.get(keyword, {})
                rising_df = kw_data.get("rising")
                if rising_df is None or rising_df.empty:
                    continue
                for _, row in rising_df.iterrows():
                    query = str(row.get("query", "")).strip()
                    value = int(row.get("value", 0))
                    if not query:
                        continue
                    trend_score = min(100, 70 + min(value, 30))
                    source_url = (
                        "https://trends.google.com/trends/explore"
                        f"?q={requests.utils.quote(query)}&geo=US&date=now+7-d"
                    )
                    trends.append(
                        {
                            "topic": query,
                            "platform": "tiktok",
                            "description": f"Rising search: {query}",
                            "source_url": source_url,
                            "trend_score": trend_score,
                        }
                    )
            time.sleep(2)
        except Exception as exc:
            log.warning(f"Google Trends error for group {group}: {exc}")
            continue

    log.info(f"Google Trends: found {len(trends)} rising queries")
    return trends


# ---------------------------------------------------------------------------
# Reddit
# ---------------------------------------------------------------------------


def fetch_top_comment_snippet(post_url: str) -> str:
    """Fetch the top comment snippet from a Reddit post (best effort)."""
    try:
        json_url = post_url.rstrip("/") + ".json?limit=1&sort=top"
        resp = requests.get(
            json_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; MissionControlScout/1.0; "
                    "+https://mission-control-app-theta.vercel.app)"
                )
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        # data[1] contains comments listing
        comments = data[1]["data"]["children"]
        if comments:
            body = comments[0]["data"].get("body", "")
            snippet = body[:120].replace("\n", " ").strip()
            if snippet:
                return snippet
    except Exception:
        pass
    return ""


def fetch_reddit_trends() -> list[dict]:
    """Fetch hot posts from configured subreddits via public JSON endpoint."""
    trends = []
    reddit_headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; MissionControlScout/1.0; "
            "+https://mission-control-app-theta.vercel.app)"
        )
    }

    for sub in REDDIT_SUBREDDITS:
        try:
            url = f"https://www.reddit.com/r/{sub}/hot.json?limit={REDDIT_POST_LIMIT}"
            log.info(f"Reddit: fetching r/{sub}")
            resp = requests.get(url, headers=reddit_headers, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            posts = data.get("data", {}).get("children", [])
            for child in posts:
                post = child.get("data", {})
                score = post.get("score", 0)
                if score < REDDIT_MIN_SCORE:
                    continue
                title = post.get("title", "").strip()
                if not title:
                    continue
                permalink = post.get("permalink", "")
                post_url = (
                    f"https://www.reddit.com{permalink}"
                    if permalink
                    else f"https://www.reddit.com/r/{sub}"
                )
                trend_score = min(100, score // 100 + 50)

                # Try to get a top comment snippet
                snippet = fetch_top_comment_snippet(post_url)
                description = title
                if snippet:
                    description = f"{title} — Top comment: {snippet}"

                trends.append(
                    {
                        "topic": title,
                        "platform": sub,
                        "description": description,
                        "source_url": post_url,
                        "trend_score": trend_score,
                    }
                )
            time.sleep(1)  # polite delay between subreddits
        except Exception as exc:
            log.warning(f"Reddit error for r/{sub}: {exc}")
            continue

    log.info(f"Reddit: found {len(trends)} qualifying posts")
    return trends


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Scout trending AI topics and POST them to Mission Control."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print trends found without POSTing to Mission Control.",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("=== DRY-RUN MODE: no data will be written to Mission Control ===")

    log.info("Starting content trend scout...")

    # --- Gather raw trends from all sources ---
    all_raw: list[dict] = []

    log.info("--- Fetching Google Trends ---")
    try:
        google_trends = fetch_google_trends()
        all_raw.extend(google_trends)
    except Exception as exc:
        log.error(f"Google Trends source failed entirely: {exc}")

    log.info("--- Fetching Reddit trends ---")
    try:
        reddit_trends = fetch_reddit_trends()
        all_raw.extend(reddit_trends)
    except Exception as exc:
        log.error(f"Reddit source failed entirely: {exc}")

    log.info(f"Total raw trends collected: {len(all_raw)}")

    # --- Deduplication ---
    log.info("Fetching existing trends for deduplication...")
    existing = fetch_existing_trends()
    seen_topics = build_dedup_set(existing)
    log.info(f"Found {len(seen_topics)} topics posted in the last {DEDUP_HOURS}h")

    new_trends: list[dict] = []
    skipped = 0
    local_seen: set[str] = set()  # dedup within this run too

    for trend in all_raw:
        key = normalize_topic(trend["topic"])
        if key in seen_topics or key in local_seen:
            skipped += 1
            log.debug(f"Skipping duplicate: {trend['topic']!r}")
            continue
        local_seen.add(key)
        new_trends.append(trend)

    log.info(f"New trends after deduplication: {len(new_trends)} ({skipped} skipped)")

    # --- Post each new trend ---
    posted = 0
    for trend in new_trends:
        if post_trend(trend, dry_run=args.dry_run):
            posted += 1

    # --- Summary ---
    total_scouted = len(new_trends) + skipped
    print(
        f"\nScouted {total_scouted} trends "
        f"({posted} new, {skipped} skipped as duplicates)"
    )
    log.info("Trend scout complete.")


if __name__ == "__main__":
    main()
