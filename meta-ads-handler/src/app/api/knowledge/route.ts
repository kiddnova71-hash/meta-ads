import { NextRequest, NextResponse } from 'next/server'

const GITHUB_RAW = 'https://raw.githubusercontent.com'

export async function GET(req: NextRequest) {
  const repo = process.env.GITHUB_REPO // e.g. "kiddnova71-hash/meta-ads"
  const branch = process.env.GITHUB_BRANCH || 'main'

  if (!repo) {
    return NextResponse.json({ error: 'GITHUB_REPO not configured' }, { status: 500 })
  }

  try {
    const url = `${GITHUB_RAW}/${repo}/${branch}/knowledge/strategies.json`
    const res = await fetch(url, {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {},
      next: { revalidate: 3600 } // cache 1 hour
    })

    if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
