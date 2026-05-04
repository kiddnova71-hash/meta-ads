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
    const entries = (data.entries || []).slice(0, 20)
    if (!entries.length) return ''
    const lines = entries.map((e: { category: string; summary: string; key_takeaway: string; confidence: number }) =>
      `[${e.category}] ${e.summary} | Takeaway: ${e.key_takeaway} (confidence: ${e.confidence})`
    ).join('\n')
    return `\n\nCURRENT KNOWLEDGE BASE (community-validated ecom Meta Ads strategies):\n${lines}\n\nReference these strategies where relevant in your suggestions.`
  } catch {
    return ''
  }
}

const BASE_SYSTEM = `You are an elite Meta Ads strategist. Analyze campaign data at campaign, ad set, and ad level. Be data-driven, specific, and direct.

CRITICAL RULES:
- NEVER suggest specific budget dollar amounts or percentages. Use directional language only: "strong candidate for scaling", "consider reducing allocation", "underperforming relative to spend".
- Reference actual numbers from the data in your analysis.
- Flag creative fatigue (frequency > 4, declining CTR over time).
- Identify audience overlap or targeting issues.
- Highlight winning creatives that should be scaled or tested in new audiences.
- Flag campaigns/adsets where conversion volume is too low for the algorithm to optimize.

Respond ONLY with valid JSON, no markdown, no code fences:
{
  "summary": "3-4 sentence account-level overview",
  "score": 0-100,
  "suggestions": [
    {
      "title": "concise title",
      "priority": "high|medium|low",
      "type": "scale|pause|test|fix|creative",
      "campaign": "campaign name",
      "adset": "adset name or null",
      "ad": "ad name or null",
      "detail": "specific, data-backed explanation with numbers",
      "impact": "what happens if actioned",
      "metric": "key metric driving this (e.g. ROAS: 0.8x, Frequency: 6.2)"
    }
  ]
}

Generate 6-10 suggestions ordered by priority. Types: scale=increase allocation signal, pause=stop/reduce, test=run experiment, fix=structural issue, creative=creative change needed.`

export async function analyzeAccount(
  campaigns: Campaign[],
  goals: string,
  accountType: string,
  geminiKey: string
): Promise<AnalysisResult> {
  const kb = await fetchKnowledgeBase()
  const systemPrompt = BASE_SYSTEM + kb

  const payload = {
    accountType,
    goals: goals || 'Maximize ROAS while scaling profitable campaigns',
    campaigns: campaigns.map(c => ({
      name: c.name, status: c.status,
      spend: c.spend, revenue: c.revenue, roas: parseFloat(c.roas.toFixed(2)),
      impressions: c.impressions, clicks: c.clicks,
      ctr: parseFloat(c.ctr.toFixed(2)), cpc: parseFloat(c.cpc.toFixed(2)),
      frequency: parseFloat(c.frequency.toFixed(2)), conversions: c.conversions,
      adsets: c.adsets?.map(s => ({
        name: s.name, status: s.status,
        spend: s.spend, roas: parseFloat(s.roas.toFixed(2)),
        ctr: parseFloat(s.ctr.toFixed(2)), frequency: parseFloat(s.frequency.toFixed(2)),
        conversions: s.conversions,
        ads: s.ads?.map(a => ({
          name: a.name, status: a.status,
          spend: a.spend, roas: parseFloat(a.roas.toFixed(2)),
          ctr: parseFloat(a.ctr.toFixed(2)), frequency: parseFloat(a.frequency.toFixed(2)),
          creative: a.creative
        }))
      }))
    }))
  }

  const fullPrompt = `${systemPrompt}\n\nAnalyze this Meta Ads account:\n\n${JSON.stringify(payload, null, 2)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
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
