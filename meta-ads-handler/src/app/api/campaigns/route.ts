import { NextRequest, NextResponse } from 'next/server'
import { fetchFullAccount } from '@/lib/meta'

export async function POST(req: NextRequest) {
  try {
    const { token, accountId, datePreset } = await req.json()
    if (!token || !accountId) return NextResponse.json({ error: 'Missing token or accountId' }, { status: 400 })
    const campaigns = await fetchFullAccount(token, accountId, datePreset || 'last_30d')
    return NextResponse.json({ campaigns })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
