import Anthropic from '@anthropic-ai/sdk'
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

const SYSTEM = `You are an elite Meta Ads strategist. Analyze campaign data at campaign, ad set, and ad level. Be data-driven, specific, and direct.

CRITICAL RULES:
- NEVER suggest specific budget dollar amounts or percentages. Use directional language only: "strong candidate for scaling", "consider reducing allocation", "underperforming relative to spend".
- Reference actual numbers from the data in your analysis.
- Flag creative fatigue (frequency > 4, declining CTR over time).
- Identify audience overlap or targeting issues.
- Highlight winning creatives that should be scaled or tested in new audiences.
- Flag campaigns/adsets where conversion volume is too low for the algorithm to optimize.

Respond ONLY with valid JSON, no markdown:
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
  apiKey: string
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey })

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

  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Analyze this Meta Ads account:\n\n${JSON.stringify(payload, null, 2)}` }]
  })

  const text = msg.content.map(b => b.type === 'text' ? b.text : '').join('')
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  return { ...parsed, generatedAt: new Date().toISOString() }
}
