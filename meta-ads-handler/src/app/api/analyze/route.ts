import { NextRequest, NextResponse } from 'next/server'
import { analyzeAccount } from '@/lib/analyze'
import type { Campaign } from '@/lib/meta'

export async function POST(req: NextRequest) {
  try {
    const { campaigns, goals, accountType } = await req.json()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
    if (!campaigns?.length) return NextResponse.json({ error: 'No campaign data provided' }, { status: 400 })
    const result = await analyzeAccount(campaigns as Campaign[], goals || '', accountType || 'ecommerce', apiKey)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
