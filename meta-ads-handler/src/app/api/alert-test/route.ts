import { NextRequest, NextResponse } from 'next/server'
import { sendSlackAlert, sendEmailAlert } from '@/lib/alerts'
import type { AnalysisResult } from '@/lib/analyze'

const MOCK: AnalysisResult = {
  score: 72,
  summary: 'This is a test alert from your Meta Ads AI Handler. Your daily reports will look like this — with real campaign data, AI-generated recommendations, and a health score for your account.',
  generatedAt: new Date().toISOString(),
  suggestions: [
    { title: 'Test: Retargeting campaign showing strong signals', priority: 'high', type: 'scale', campaign: 'Retargeting - Cart Abandoners', detail: 'ROAS of 6.2x with healthy frequency (2.1). Conversion volume is sufficient for algorithm optimization. This is a test suggestion — real analysis will reference your actual numbers.', impact: 'Could significantly increase profitable conversions', metric: 'ROAS: 6.2x' },
    { title: 'Test: Broad prospecting showing creative fatigue', priority: 'medium', type: 'creative', campaign: 'Prospecting - Broad', detail: 'Frequency has reached 5.8 with declining CTR (0.6% vs 1.4% two weeks ago). New creative variations needed. This is a test suggestion.', impact: 'Refreshing creative could restore CTR to prior levels', metric: 'Frequency: 5.8' },
    { title: 'Test: Low-spend ad set needs more data', priority: 'low', type: 'fix', campaign: 'Brand Awareness', detail: 'Ad set has only 3 conversions in 30 days — not enough for the algorithm to optimize effectively. This is a test suggestion.', impact: 'Consolidating into fewer ad sets could improve delivery', metric: 'Conversions: 3' }
  ]
}

export async function POST(req: NextRequest) {
  try {
    const { slackWebhook, emailTo, smtpHost, smtpPort, smtpUser, smtpPass, accountName } = await req.json()
    const name = accountName || 'My Ad Account'
    const errors: string[] = []

    if (slackWebhook) {
      try { await sendSlackAlert(slackWebhook, MOCK, name) }
      catch (e: unknown) { errors.push('Slack: ' + (e instanceof Error ? e.message : String(e))) }
    }

    if (emailTo && smtpHost && smtpUser && smtpPass) {
      try {
        await sendEmailAlert({ host: smtpHost, port: parseInt(smtpPort || '587'), user: smtpUser, pass: smtpPass }, emailTo, MOCK, name)
      } catch (e: unknown) { errors.push('Email: ' + (e instanceof Error ? e.message : String(e))) }
    }

    if (errors.length) return NextResponse.json({ error: errors.join(' | ') }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
