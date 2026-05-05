import type { Campaign } from './meta'

export interface Suggestion {
  title: string
  priority: 'high' | 'medium' | 'low'
  type: 'scale' | 'pause' | 'test' | 'fix' | 'creative'
  campaign: string
  adset?: string
  ad?: string
  detail: string
  impact: string
  metric?: string
}

export interface AnalysisResult {
  summary: string
  score: number
  suggestions: Suggestion[]
  generatedAt: string
}

async function fetchKnowledgeBase(): Promise<string> {
  try {
    const repo = process.env.GITHUB_REPO
    const branch = process.env.GITHUB_BRANCH || 'main'
    if (!repo) return ''
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/knowledge/strategies.json`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return ''
    const data = await res.json()
    const entries = (data.entries || []).slice(0, 10)
    if (!entries.length) return ''
    const lines = entries.map((e: { category: string; key_takeaway: string }) =>
      `[${e.category}] ${e.key_takeaway}`
    ).join('\n')
    return `\n\nKNOWLEDGE BASE:\n${lines}`
  } catch {
    return ''
  }
}

const BASE_SYSTEM = `You are a Meta Ads strategist. Analyze campaign data and return ONLY a JSON object.

RULES:
- Never suggest specific budget amounts
- Reference actual numbers from the data
- Flag creative fatigue when frequency > 4
- Keep all text fields under 100 characters

Return ONLY this JSON structure with no extra text:
{
  "summary": "2-3 sentence overview under 200 chars",
  "score": 75,
  "suggestions": [
    {
      "title": "short title under 50 chars",
      "priority": "high",
      "type": "scale",
      "campaign": "campaign name",
      "adset": null,
      "ad": null,
      "detail": "specific explanation under 100 chars",
      "impact": "expected outcome under 80 chars",
      "metric": "ROAS: 0.8x"
    }
  ]
}

Generate exactly 5 suggestions ordered by priority.`

export async function analyzeAccount(
  campaigns: Campaign[],
  goals: string,
  accountType: string,
  geminiKey: string
): Promise<AnalysisResult> {
  const kb = await fetchKnowledgeBase()
  const system = BASE_SYSTEM + kb

  // Send condensed campaign data to reduce token usage
  const condensed = campaigns.map(c => ({
    name: c.name,
    status: c.status,
    spend: c.spend,
    roas: parseFloat(c.roas.toFixed(2)),
    ctr: parseFloat(c.ctr.toFixed(2)),
    frequency: parseFloat(c.frequency.toFixed(2)),
    conversions: c.conversions,
    adsets: c.adsets?.slice(0, 3).map(s => ({
      name: s.name,
      roas: parseFloat(s.roas.toFixed(2)),
      ctr: parseFloat(s.ctr.toFixed(2)),
      frequency: parseFloat(s.frequency.toFixed(2)),
    }))
  }))

  const prompt = `${system}\n\nAccount type: ${accountType}\nGoals: ${goals || 'Maximize ROAS'}\n\nCampaigns:\n${JSON.stringify(condensed)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json'
        }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  return { ...parsed, generatedAt: new Date().toISOString() }
}
