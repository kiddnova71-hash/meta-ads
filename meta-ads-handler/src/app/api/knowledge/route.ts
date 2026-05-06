import { NextRequest, NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const FILE_PATH = 'knowledge/strategies.json'

async function getFile() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    if (!GITHUB_REPO || !GITHUB_TOKEN) {
      return NextResponse.json({ version: 1, last_updated: '', entries: [], stats: {} })
    }
    const file = await getFile()
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'))
    return NextResponse.json(content)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!GITHUB_REPO || !GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_REPO or GITHUB_TOKEN not set' }, { status: 500 })
    }

    const body = await req.json()
    body.last_updated = new Date().toISOString()

    // Recalculate stats
    body.stats = {
      total: body.entries.length,
      by_category: body.entries.reduce((acc: Record<string, number>, e: { category: string }) => {
        acc[e.category] = (acc[e.category] || 0) + 1
        return acc
      }, {}),
      avg_confidence: body.entries.length
        ? parseFloat((body.entries.reduce((a: number, e: { confidence: number }) => a + e.confidence, 0) / body.entries.length).toFixed(2))
        : 0
    }

    // Get current SHA for update
    const file = await getFile()
    const sha = file.sha

    const content = Buffer.from(JSON.stringify(body, null, 2)).toString('base64')
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Update knowledge base via UI',
        content,
        sha,
        branch: GITHUB_BRANCH,
      })
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`GitHub PUT failed: ${res.status} ${err}`)
    }

    return NextResponse.json(body)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
