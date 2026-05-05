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

  const step1 = await geminiCall(geminiKey,
    `Meta Ads data: ${dataStr}
Goals: ${goals || 'Maximize ROAS'}
Return JSON: {"summary":"max 100 chars total","score":75}
Keep summary under 100 characters.`)

  const step2 = await geminiCall(geminiKey,
    `Meta Ads data: ${dataStr}
Return JSON with 3 suggestions. Keep each field under 60 chars:
{"suggestions":[{"title":"x","priority":"high","type":"scale","campaign":"x","adset":null,"ad":null,"detail":"x","impact":"x","metric":"x"},{"title":"x","priority":"medium","type":"fix","campaign":"x","adset":null,"ad":null,"detail":"x","impact":"x","metric":"x"},{"title":"x","priority":"low","type":"test","campaign":"x","adset":null,"ad":null,"detail":"x","impact":"x","metric":"x"}]}`)

  try {
    const part1 = JSON.parse(step1.trim())
    const part2 = JSON.parse(step2.trim())
    return {
      summary: part1.summary || 'Analysis complete.',
      score: part1.score || 50,
      suggestions: part2.suggestions || [],
      generatedAt: new Date().toISOString()
    }
  } catch(e) {
    throw new Error(`Parse failed. S1: ${step1.substring(0,150)} S2: ${step2.substring(0,150)}`)
  }
}
