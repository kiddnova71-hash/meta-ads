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
GEMINI_KEY = os.environ["GEMINI_API_KEY"]

# Top accounts to monitor (add/remove as you discover better ones)
TARGET_ACCOUNTS = [
    "jonloomer",
    "andrewhubbard_",
    "samuelpng",
    "BenHeath",
    "NickShackelford",
    "GoodMktg",
    "RichardGaffneyy",
    "CTilchin",
    "patrickdang",
    "drewsimms_",
    "ecommerceceo",
    "FoxwellDigital",
]

# Keywords to search beyond just accounts
SEARCH_QUERIES = [
    "meta ads ecommerce strategy",
    "facebook ads ROAS scaling 2025",
    "meta ads creative testing ecom",
    "facebook ads creative fatigue fix",
    "meta ads broad targeting results",
    "advantage+ shopping campaign results",
    "meta ads cost cap strategy ecom",
    "facebook ads creative hook ecommerce",
    "meta ads audience targeting 2025",
    "facebook ads scaling profitable",
]

KNOWLEDGE_FILE = "knowledge/strategies.json"
MIN_CONFIDENCE = 0.55  # Only save entries scoring above this
MAX_TWEETS_PER_RUN = 80  # Keep Apify costs low


# ── Apify scraping ─────────────────────────────────────────────────────────────

def scrape_account_tweets(client: ApifyClient, username: str, max_items: int = 15) -> list:
    """Pull recent tweets from a specific account."""
    print(f"  Scraping @{username}...")
    try:
        run = client.actor("quacker/twitter-scraper").call(
            run_input={
                "handle": [username],
                "tweetsDesired": max_items,
                "addUserInfo": True,
                "proxyConfig": {"useApifyProxy": True},
            },
            timeout_secs=120,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        # Filter to tweets that mention ads/meta/facebook
        relevant = [
            t for t in items
            if any(kw in (t.get("full_text") or t.get("text") or "").lower()
                   for kw in ["meta ads", "facebook ads", "fb ads", "roas", "creative", "ad account", "campaign"])
        ]
        print(f"    → {len(relevant)}/{len(items)} relevant tweets")
        return relevant
    except Exception as e:
        print(f"    ✗ Failed: {e}")
        return []


def scrape_search_tweets(client: ApifyClient, query: str, max_items: int = 10) -> list:
    """Search for tweets by keyword."""
    print(f"  Searching: '{query}'...")
    try:
        run = client.actor("quacker/twitter-scraper").call(
            run_input={
                "searchTerms": [query],
                "tweetsDesired": max_items,
                "addUserInfo": True,
                "proxyConfig": {"useApifyProxy": True},
            },
            timeout_secs=120,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        print(f"    → {len(items)} tweets")
        return items
    except Exception as e:
        print(f"    ✗ Failed: {e}")
        return []


def scrape_replies(client: ApifyClient, tweet_id: str, max_items: int = 20) -> list:
    """Get replies/comments for a tweet."""
    try:
        run = client.actor("quacker/twitter-scraper").call(
            run_input={
                "conversationIds": [tweet_id],
                "tweetsDesired": max_items,
                "proxyConfig": {"useApifyProxy": True},
            },
            timeout_secs=60,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        return [t for t in items if t.get("in_reply_to_status_id_str") == tweet_id]
    except Exception:
        return []


# ── Gemini scoring ─────────────────────────────────────────────────────────────

SCORE_PROMPT = """You are an expert Meta/Facebook ads strategist evaluating tweets for a knowledge base.

Analyze this tweet and its comments. Score and classify it.

Return ONLY valid JSON, no markdown, no extra text:
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
- confidence 0.8+: Clear, specific, actionable strategy with evidence it works
- confidence 0.6-0.8: Reasonable strategy, plausible but less proven
- confidence 0.4-0.6: Generic advice or unclear
- confidence <0.4: Opinion, complaint, irrelevant, or contradicted by comments
- is_strategy: false if it's a complaint, question, meme, or personal story with no actionable takeaway
- requires_budget: true ONLY if the strategy is purely about setting specific budget amounts"""


def score_tweet(tweet_text: str, author: str, replies: list) -> dict | None:
    """Use Gemini Flash (free tier) to score and classify a tweet."""
    reply_texts = "\n".join([
        f"  @{r.get('user', {}).get('screen_name', 'user')}: {r.get('full_text') or r.get('text') or ''}"
        for r in replies[:10]
    ])

    prompt = f"""{SCORE_PROMPT}

Tweet by @{author}:
"{tweet_text}"

Comments ({len(replies)} total):
{reply_texts if reply_texts else "(no comments)"}"""

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 500}
    }).encode("utf-8")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"

    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Strip markdown code fences if present
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
    kb["stats"] = {
        "total": len(kb["entries"]),
        "by_category": {},
        "avg_confidence": 0,
    }
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


def add_entry(kb: dict, tweet: dict, score: dict, replies: list):
    tweet_id = tweet.get("id_str") or tweet.get("id") or ""
    author = tweet.get("user", {}).get("screen_name") or tweet.get("author_id") or "unknown"
    text = tweet.get("full_text") or tweet.get("text") or ""
    url = f"https://x.com/{author}/status/{tweet_id}" if tweet_id else ""

    entry = {
        "id": tweet_id_hash(str(tweet_id)),
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
        "reply_count": len(replies),
        "likes": tweet.get("favorite_count") or tweet.get("public_metrics", {}).get("like_count") or 0,
        "retweets": tweet.get("retweet_count") or tweet.get("public_metrics", {}).get("retweet_count") or 0,
        "date_scraped": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "date_posted": tweet.get("created_at", "")[:10] if tweet.get("created_at") else "",
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
    tweet_count = 0

    # Scrape target accounts (prioritized)
    print("\n[ Scraping target accounts ]")
    for username in TARGET_ACCOUNTS:
        if tweet_count >= MAX_TWEETS_PER_RUN:
            break
        tweets = scrape_account_tweets(apify, username, max_items=8)
        all_tweets.extend(tweets)
        tweet_count += len(tweets)
        time.sleep(2)

    # Scrape keyword searches
    print("\n[ Keyword searches ]")
    for query in SEARCH_QUERIES[:5]:  # Limit to keep costs low
        if tweet_count >= MAX_TWEETS_PER_RUN:
            break
        tweets = scrape_search_tweets(apify, query, max_items=6)
        all_tweets.extend(tweets)
        tweet_count += len(tweets)
        time.sleep(2)

    print(f"\nTotal tweets collected: {len(all_tweets)}")

    # Deduplicate
    seen_ids = set()
    unique_tweets = []
    for t in all_tweets:
        tid = str(t.get("id_str") or t.get("id") or "")
        if tid and tid not in seen_ids:
            if not entry_exists(kb, tid):
                seen_ids.add(tid)
                unique_tweets.append(t)

    print(f"New tweets to process: {len(unique_tweets)}")

    # Score each tweet
    print("\n[ Scoring with Gemini (free) ]")
    added = 0
    skipped = 0

    for i, tweet in enumerate(unique_tweets):
        text = tweet.get("full_text") or tweet.get("text") or ""
        author = tweet.get("user", {}).get("screen_name") or "unknown"
        tweet_id = str(tweet.get("id_str") or tweet.get("id") or "")

        if len(text) < 50:
            skipped += 1
            continue

        print(f"\n  [{i+1}/{len(unique_tweets)}] @{author}: {text[:80]}...")

        # Get replies for high-engagement tweets
        replies = []
        likes = tweet.get("favorite_count") or 0
        if likes > 20 and tweet_id:
            replies = scrape_replies(apify, tweet_id, max_items=15)
            print(f"    {len(replies)} replies fetched")

        # Score with Gemini
        score = score_tweet(text, author, replies)
        if not score:
            skipped += 1
            continue

        print(f"    Strategy: {score.get('is_strategy')} | Confidence: {score.get('confidence')} | Category: {score.get('category')}")

        if score.get("is_strategy") and score.get("confidence", 0) >= MIN_CONFIDENCE:
            add_entry(kb, tweet, score, replies)
            added += 1
            print(f"    ✓ Added to knowledge base")
        else:
            skipped += 1
            print(f"    ✗ Skipped (below threshold)")

        time.sleep(1)  # Rate limiting

    save_knowledge(kb)

    print("\n" + "=" * 60)
    print(f"Run complete:")
    print(f"  Tweets processed: {len(unique_tweets)}")
    print(f"  Added to KB:      {added}")
    print(f"  Skipped:          {skipped}")
    print(f"  Total in KB:      {len(kb['entries'])} ({existing_count} before)")
    print("=" * 60)


if __name__ == "__main__":
    main()
