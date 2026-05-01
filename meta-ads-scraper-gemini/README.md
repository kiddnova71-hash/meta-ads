# Meta Ads Knowledge Scraper

Automatically scrapes X/Twitter for Meta ads strategies, scores them with Claude AI, and stores them in a knowledge base that feeds your Vercel ads manager.

---

## How it works

1. **GitHub Actions** runs the Python scraper daily at 6 AM UTC
2. Scraper pulls tweets from target accounts + keyword searches via **Apify**
3. **Claude AI** scores each tweet: is it a real strategy? How confident? What do comments say?
4. High-quality entries are saved to `knowledge/strategies.json` in this repo
5. Your **Vercel app** reads the JSON file and shows it in the Knowledge Base tab
6. Claude uses the knowledge base as context when analyzing your actual campaigns

---

## Setup (one-time, ~10 minutes)

### Step 1 — Add files to your existing meta-ads GitHub repo

Copy these files into your `kiddnova71-hash/meta-ads` repo:

```
scripts/scraper.py          → scripts/scraper.py
scripts/requirements.txt    → scripts/requirements.txt
.github/workflows/scraper.yml → .github/workflows/scraper.yml
knowledge/strategies.json   → knowledge/strategies.json
```

For the Vercel app additions, add to your existing Next.js project:
```
vercel-additions/api/knowledge/route.ts → src/app/api/knowledge/route.ts
vercel-additions/knowledge/page.tsx     → src/app/knowledge/page.tsx
```

### Step 2 — Get your Apify token

1. Go to [apify.com](https://apify.com) → sign up free
2. Click your avatar → Settings → Integrations → **API token**
3. Copy the token

### Step 3 — Create a GitHub Personal Access Token (PAT)

The scraper needs to write back to your repo after running.

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Name it: `Meta Ads Scraper`
4. Expiration: 1 year
5. Check: **repo** (full control of private repositories)
6. Click **Generate token** — copy it immediately

### Step 4 — Add GitHub Actions secrets

In your `meta-ads` GitHub repo:
- Go to **Settings → Secrets and variables → Actions**
- Click **New repository secret** for each:

| Secret name | Value |
|---|---|
| `APIFY_API_TOKEN` | Your Apify token |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `GH_PAT` | Your GitHub Personal Access Token |

### Step 5 — Add Vercel env variables

In your Vercel project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `GITHUB_REPO` | `kiddnova71-hash/meta-ads` |
| `GITHUB_BRANCH` | `main` |

Then **redeploy** your Vercel app.

### Step 6 — Test the scraper manually

In your GitHub repo: **Actions tab → Meta Ads Knowledge Scraper → Run workflow**

Watch the logs. After it finishes, check `knowledge/strategies.json` — it should have new entries.

---

## Customizing target accounts

Edit `scripts/scraper.py` — the `TARGET_ACCOUNTS` list at the top. Add any X handles of people you follow who post great Meta ads content.

## Adjusting quality threshold

In `scripts/scraper.py`:
```python
MIN_CONFIDENCE = 0.55  # Lower = more entries, less quality
                       # Higher = fewer entries, higher quality
```

---

## Viewing the knowledge base

Visit: `your-app.vercel.app/knowledge`

Filter by category, funnel stage, confidence score, or search by keyword.
