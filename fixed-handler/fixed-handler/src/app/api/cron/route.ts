import { NextRequest, NextResponse } from 'next/server'
import { fetchFullAccount } from '@/lib/meta'
import { analyzeAccount } from '@/lib/analyze'
import { sendSlackAlert, sendEmailAlert } from '@/lib/alerts'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID
  const geminiKey = process.env.GEMINI_API_KEY
  const slackWebhook = process.env.SLACK_WEBHOOK_URL
  const emailTo = process.env.ALERT_EMAIL_TO
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = parseInt(process.env.SMTP_PORT || '587')
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const accountName = process.env.ACCOUNT_NAME || 'My Ad Account'
  const goals = process.env.ACCOUNT_GOALS || ''
  const accountType = process.env.ACCOUNT_TYPE || 'ecommerce'
  const datePreset = process.env.DATE_PRESET || 'last_7d'

  if (!token || !accountId || !geminiKey) {
    return NextResponse.json({ error: 'Missing META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, or GEMINI_API_KEY' }, { status: 500 })
  }

  try {
    const campaigns = await fetchFullAccount(token, accountId, datePreset)
    const result = await analyzeAccount(campaigns, goals, accountType, geminiKey)

    if (slackWebhook) await sendSlackAlert(slackWebhook, result, accountName)
    if (emailTo && smtpHost && smtpUser && smtpPass) {
      await sendEmailAlert({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass }, emailTo, result, accountName)
    }

    return NextResponse.json({ ok: true, score: result.score, suggestions: result.suggestions.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Cron error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
