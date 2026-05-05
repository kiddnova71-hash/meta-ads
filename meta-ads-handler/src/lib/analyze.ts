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

async function geminiCall(geminiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500,
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
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
}

async function getSuggestion(geminiKey: string, dataStr: string, priority: string, type: string): Promise<Suggestion> {
  const text = await geminiCall(geminiKey,
    `Meta Ads: ${dataStr}
Give 1 ${priority} priority ${type} suggestion.
Return JSON only: {"title":"max 40 chars","priority":"${priority}","type":"${type}","campaign":"name","adset":null,"ad":null,"detail":"max 80 chars","impact":"max 60 chars","metric":"e.g. ROAS:2x"}`)
  const parsed = JSON.parse(text.trim())
  return parsed
}

export async function analyzeAccount(
  campaigns: Campaign[],
  goals: string,
  accountType: string,
  geminiKey: string
): Promise<AnalysisResult> {

  const condensed = campaigns.slice(0, 8).map(c => ({
    n: c.name.substring(0, 25),
    sp: c.spend,
    r: parseFloat(c.roas.toFixed(2)),
    ct: parseFloat(c.ctr.toFixed(2)),
    f: parseFloat(c.frequency.toFixed(2)),
    cv: c.conversions,
  }))

  const dataStr = JSON.stringify(condensed)

  // Run all calls in parallel
  const [step1, s1, s2, s3] = await Promise.all([
    geminiCall(geminiKey,
      `Meta Ads: ${dataStr}
Goals: ${goals || 'Maximize ROAS'}
Return JSON: {"summary":"max 100 chars","score":75}`),
    getSuggestion(geminiKey, dataStr, 'high', 'scale'),
    getSuggestion(geminiKey, dataStr, 'medium', 'fix'),
    getSuggestion(geminiKey, dataStr, 'low', 'test'),
  ])

  const part1 = JSON.parse(step1.trim())

  return {
    summary: part1.summary || 'Analysis complete.',
    score: part1.score || 50,
    suggestions: [s1, s2, s3],
    generatedAt: new Date().toISOString()
  }
}
