# Meta Ads AI Handler

AI-powered Meta Ads analysis with daily Slack & email alerts. Built with Next.js + Claude AI.

---

## Deploy to Vercel (5 minutes, free)

### Step 1 — Push to GitHub

1. Create a new repo on github.com (click **New repository**)
2. Upload all these files to it (drag & drop works)

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up free with your GitHub account
2. Click **Add New → Project**
3. Import your GitHub repo
4. Click **Deploy** — it builds automatically

### Step 3 — Set environment variables

In your Vercel project: **Settings → Environment Variables**, add each variable from `.env.example`:

| Variable | Where to get it |
|---|---|
| `META_ACCESS_TOKEN` | Meta Business Suite → Settings → System Users → Generate token with `ads_read` |
| `META_AD_ACCOUNT_ID` | Business Manager → Ad Accounts (format: `act_1234567890`) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SLACK_WEBHOOK_URL` | Slack → Apps → Incoming Webhooks → Add New |
| `ALERT_EMAIL_TO` | Your email address |
| `SMTP_HOST` | `smtp.gmail.com` for Gmail |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Gmail → Google Account → Security → 2FA → App Passwords |
| `CRON_SECRET` | Any random string (e.g. generate at randomkeygen.com) |
| `ACCOUNT_NAME` | Your brand name |
| `ACCOUNT_GOALS` | Your KPIs in plain text |

### Step 4 — Redeploy

After setting env variables: **Deployments → Redeploy** (or push any change to GitHub).

### Step 5 — Test alerts

Open your app URL, go to **Daily Alerts tab**, enter your Slack webhook / email, click **Send test alert**.

---

## Daily alerts schedule

Alerts fire every day at **7:00 AM UTC** automatically.

The cron endpoint is: `GET /api/cron` (secured with `CRON_SECRET`).

---

## Using the app

1. **Connect tab** — paste your Meta access token + ad account ID, or paste JSON data manually
2. **Campaigns tab** — see all campaigns with ROAS, CTR, frequency, and health scores. Click a row to expand ad sets.
3. **AI Analysis tab** — click "Analyze with AI" to get Claude's recommendations
4. **Daily Alerts tab** — configure Slack/email and test before going live

---

## What the AI analyzes

- ROAS efficiency per campaign and ad set
- Creative fatigue (frequency > 4 with declining CTR)  
- Campaign structure issues (too few conversions for algorithm optimization)
- Audience overlap signals
- Scaling candidates vs underperformers
- Creative-level performance

**The AI never suggests specific budget amounts** — only directional signals ("strong scaling candidate", "consider reducing allocation"). All budget changes require human approval.

---

## Gmail app password setup

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification (must be on)
3. Search for "App passwords" → Create one named "Meta Ads Handler"
4. Use that 16-character password as `SMTP_PASS`
# Meta Ads Handler
