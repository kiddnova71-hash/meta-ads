#!/usr/bin/env python3
"""
Meta Ads Knowledge Scraper
Scrapes X/Twitter via Apify, scores content with Gemini AI, saves to knowledge base JSON.
"""

import os
import json
import time
import hashlib
import urllib.request
from datetime import datetime, timezone
from apify_client import ApifyClient

# ── Config ────────────────────────────────────────────────────────────────────

APIFY_TOKEN = os.environ["APIFY_API_TOKEN"]
GEMINI_KEY  = os.environ["GEMINI_API_KEY"]

TARGET_ACCOUNTS = [
    "jonloomer", "andrewhubbard_", "samuelpng", "BenHeath",
    "NickShackelford", "GoodMktg", "RichardGaffneyy",
    "patrickdang", "ecommerceceo", "FoxwellDigital",
]

SEARCH_QUERIES = [
    "meta ads ecommerce strategy",
    "facebook ads ROAS scaling 2025",
    "meta ads creative testing ecom",
    "facebook ads creative fatigue fix",
    "advantage+ shopping campaign results",
    "meta ads broad targeting results",
    "facebook ads scaling profitable",
]

KNOWLEDGE_FILE = "knowledge/strategies.json"
MIN_CONFIDENCE = 0.55
MAX_TWEETS_PER_RUN = 60

ACTOR_ID = "apidojo/tweet-scraper"  # ← correct current actor

# ── Apify scraping ─────────────────────────────────────────────────────────────

def scrape_tweets(client: ApifyClient, query: str, max_items: int = 15) -> list:
    """Search tweets by query using Tweet Scraper V2."""
    print(f"  Searching: '{query}'...")
    try:
        run = client.actor(ACTOR_ID).call(
            run_input={
                "searchTerms": [query],
                "maxItems": max_items,
                "queryType": "Latest",
            },
            timeout_secs=180,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        print(f"    → {len(items)} tweets")
        return items
    except Exception as e:
        print(f"    ✗ Failed: {e}")
        return []


def scrape_account(client: ApifyClient, username: str, max_items: int = 10) -> list:
    """Pull recent tweets from a specific account."""
    print(f"  Scraping @{username}...")
    try:
        run = client.actor(ACTOR_ID).call(
            run_input={
                "searchTerms": [f"from:{username} (meta ads OR facebook ads OR ROAS OR creative)"],
                "maxItems": max_items,
                "queryType": "Latest",
            },
            timeout_secs=180,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        print(f"    → {len(items)} tweets")
        return items
    except Exception as e:
        print(f"    ✗ Failed: {e}")
        return []


# ── Gemini scoring ─────────────────────────────────────────────────────────────

SCORE_PROMPT = """You are an expert Meta/Facebook ads strategist evaluating tweets for a knowledge base.

Analyze this tweet and its comments. Score and classify it.

Return ONLY valid JSON, no markdown:
{
  "is_strategy": true,
  "confidence": 0.0,
  "category": "creative_testing|audience_targeting|bidding_strategy|campaign_structure|scaling|creative_fatigue|budget_strategy|creative_hooks|tracking|general",
  "funnel_stage": "TOF|MOF|BOF|full_funnel|general",
  "summary": "1-2 sentence plain English summary of the strategy",
  "key_takeaway": "The single most actionable thing from this",
  "comment_sentiment": "validating|mixed|contradicting|no_comments",
  "comment_notes": "brief note on what comments said",
  "applicable_to": ["ecommerce"],
  "requires_budget": false
}

Scoring guide:
- confidence 0.8+: Clear, specific, actionable strategy with evidence
- confidence 0.6-0.8: Reasonable strategy, plausible but less proven
- confidence 0.4-0.6: Generic advice or unclear
- confidence <0.4: Opinion, complaint, or irrelevant
- is_strategy: false if complaint, question, meme, or no actionable takeaway"""


def score_tweet(tweet_text: str, author: str, replies: list) -> dict | None:
    reply_texts = "\n".join([
        f"  @{r.get('author', {}).get('userName', 'user')}: {r.get('text', '')}"
        for r in replies[:8]
    ])

    prompt = f"""{SCORE_PROMPT}

Tweet by @{author}:
"{tweet_text}"

Comments ({len(replies)} total):
{reply_texts if reply_texts else "(no comments)"}"""

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 400}
    }).encode("utf-8")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"

    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"    Scoring error: {e}")
        return None


# ── Knowledge base ─────────────────────────────────────────────────────────────

def load_knowledge() -> dict:
    if os.path.exists(KNOWLEDGE_FILE):
        with open(KNOWLEDGE_FILE) as f:
            return json.load(f)
    return {"version": 1, "last_updated": "", "entries": [], "stats": {}}


def save_knowledge(kb: dict):
    kb["last_updated"] = datetime.now(timezone.utc).isoformat()
    kb["stats"] = {"total": len(kb["entries"]), "by_category": {}, "avg_confidence": 0}
    for e in kb["entries"]:
        cat = e.get("category", "general")
        kb["stats"]["by_category"][cat] = kb["stats"]["by_category"].get(cat, 0) + 1
    if kb["entries"]:
        kb["stats"]["avg_confidence"] = round(
            sum(e.get("confidence", 0) for e in kb["entries"]) / len(kb["entries"]), 2
        )
    os.makedirs("knowledge", exist_ok=True)
    with open(KNOWLEDGE_FILE, "w") as f:
        json.dump(kb, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Knowledge base saved: {len(kb['entries'])} total entries")


def tweet_id_hash(tweet_id: str) -> str:
    return hashlib.md5(tweet_id.encode()).hexdigest()[:12]


def entry_exists(kb: dict, tweet_id: str) -> bool:
    uid = tweet_id_hash(tweet_id)
    return any(e.get("id") == uid for e in kb["entries"])


def add_entry(kb: dict, tweet: dict, score: dict):
    tweet_id = str(tweet.get("id") or tweet.get("id_str") or "")
    author = tweet.get("author", {}).get("userName") or tweet.get("user", {}).get("screen_name") or "unknown"
    text = tweet.get("text") or tweet.get("full_text") or ""
    url = f"https://x.com/{author}/status/{tweet_id}" if tweet_id else ""

    entry = {
        "id": tweet_id_hash(tweet_id),
        "summary": score.get("summary", ""),
        "key_takeaway": score.get("key_takeaway", ""),
        "category": score.get("category", "general"),
        "funnel_stage": score.get("funnel_stage", "general"),
        "confidence": score.get("confidence", 0),
        "comment_sentiment": score.get("comment_sentiment", "no_comments"),
        "comment_notes": score.get("comment_notes", ""),
        "applicable_to": score.get("applicable_to", ["ecommerce"]),
        "requires_budget": score.get("requires_budget", False),
        "source_author": f"@{author}",
        "source_url": url,
        "source_text": text[:500],
        "likes": tweet.get("likeCount") or tweet.get("favorite_count") or 0,
        "retweets": tweet.get("retweetCount") or tweet.get("retweet_count") or 0,
        "date_scraped": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "date_posted": (tweet.get("createdAt") or tweet.get("created_at") or "")[:10],
    }
    kb["entries"].append(entry)


# ── Main pipeline ──────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Meta Ads Knowledge Scraper")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)

    apify = ApifyClient(APIFY_TOKEN)
    kb = load_knowledge()
    existing_count = len(kb["entries"])
    all_tweets = []

    # Scrape target accounts
    print("\n[ Scraping target accounts ]")
    for username in TARGET_ACCOUNTS[:5]:  # Limit to 5 accounts per run to save credits
        tweets = scrape_account(apify, username, max_items=8)
        all_tweets.extend(tweets)
        time.sleep(3)

    # Keyword searches
    print("\n[ Keyword searches ]")
    for query in SEARCH_QUERIES[:4]:
        tweets = scrape_tweets(apify, query, max_items=8)
        all_tweets.extend(tweets)
        time.sleep(3)

    print(f"\nTotal tweets collected: {len(all_tweets)}")

    # Deduplicate
    seen_ids = set()
    unique_tweets = []
    for t in all_tweets:
        tid = str(t.get("id") or t.get("id_str") or "")
        if tid and tid not in seen_ids and not entry_exists(kb, tid):
            seen_ids.add(tid)
            unique_tweets.append(t)

    print(f"New tweets to process: {len(unique_tweets)}")

    # Score each tweet
    print("\n[ Scoring with Gemini ]")
    added = 0
    skipped = 0

    for i, tweet in enumerate(unique_tweets[:MAX_TWEETS_PER_RUN]):
        text = tweet.get("text") or tweet.get("full_text") or ""
        author = tweet.get("author", {}).get("userName") or "unknown"

        if len(text) < 50:
            skipped += 1
            continue

        print(f"\n  [{i+1}/{len(unique_tweets)}] @{author}: {text[:80]}...")

        score = score_tweet(text, author, [])
        if not score:
            skipped += 1
            continue

        print(f"    Strategy: {score.get('is_strategy')} | Confidence: {score.get('confidence')} | Category: {score.get('category')}")

        if score.get("is_strategy") and score.get("confidence", 0) >= MIN_CONFIDENCE:
            add_entry(kb, tweet, score)
            added += 1
            print(f"    ✓ Added")
        else:
            skipped += 1
            print(f"    ✗ Skipped")

        time.sleep(1)

    save_knowledge(kb)

    print("\n" + "=" * 60)
    print(f"Run complete:")
    print(f"  Added to KB:  {added}")
    print(f"  Skipped:      {skipped}")
    print(f"  Total in KB:  {len(kb['entries'])} ({existing_count} before)")
    print("=" * 60)


if __name__ == "__main__":
    main()
