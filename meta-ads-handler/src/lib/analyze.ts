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
          maxOutputTokens: 800,
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
    n: c.name.substring(0, 30),
    s: c.status,
    sp: c.spend,
    r: parseFloat(c.roas.toFixed(2)),
    ct: parseFloat(c.ctr.toFixed(2)),
    f: parseFloat(c.frequency.toFixed(2)),
    cv: c.conversions,
  }))

  // Step 1: Get summary and score
  const step1 = await geminiCall(geminiKey, 
    `Meta Ads account analysis. Goals: ${goals || 'Maximize ROAS'}. Data: ${JSON.stringify(condensed)}
    
Return JSON only: {"summary":"2 sentence overview","score":75}`)

  // Step 2: Get suggestions separately  
  const step2 = await geminiCall(geminiKey,
    `Meta Ads campaigns: ${JSON.stringify(condensed)}
    
Return JSON only with exactly 3 suggestions:
{"suggestions":[
{"title":"t","priority":"high","type":"scale","campaign":"c","adset":null,"ad":null,"detail":"d","impact":"i","metric":"m"},
{"title":"t","priority":"medium","type":"fix","campaign":"c","adset":null,"ad":null,"detail":"d","impact":"i","metric":"m"},
{"title":"t","priority":"low","type":"test","campaign":"c","adset":null,"ad":null,"detail":"d","impact":"i","metric":"m"}
]}`)

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
    throw new Error(`Parse failed. Step1: ${step1.substring(0,200)} Step2: ${step2.substring(0,200)}`)
  }
}
