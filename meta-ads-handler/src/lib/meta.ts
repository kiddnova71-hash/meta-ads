export interface Campaign {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  frequency: number
  conversions: number
  revenue: number
  roas: number
  adsets?: AdSet[]
}

export interface AdSet {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  frequency: number
  conversions: number
  revenue: number
  roas: number
  targeting?: Record<string, unknown>
  ads?: Ad[]
}

export interface Ad {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  frequency: number
  conversions: number
  revenue: number
  roas: number
  creative?: {
    title?: string
    body?: string
    image_url?: string
    call_to_action?: string
  }
}

const META_API = 'https://graph.facebook.com/v19.0'
const INSIGHT_FIELDS = 'spend,impressions,clicks,ctr,cpc,frequency,actions,action_values'

function parseInsights(ins: Record<string, unknown> | undefined) {
  if (!ins) return { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, frequency: 0, conversions: 0, revenue: 0, roas: 0 }
  const actions = (ins.actions as Array<{ action_type: string; value: string }>) || []
  const actionValues = (ins.action_values as Array<{ action_type: string; value: string }>) || []
  const conversions = parseFloat(actions.find(a => a.action_type === 'purchase')?.value || '0')
  const revenue = parseFloat(actionValues.find(a => a.action_type === 'purchase')?.value || '0')
  const spend = parseFloat(ins.spend as string || '0')
  return {
    spend,
    impressions: parseInt(ins.impressions as string || '0'),
    clicks: parseInt(ins.clicks as string || '0'),
    ctr: parseFloat(ins.ctr as string || '0'),
    cpc: parseFloat(ins.cpc as string || '0'),
    frequency: parseFloat(ins.frequency as string || '0'),
    conversions,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
  }
}

export async function fetchCampaigns(token: string, accountId: string, datePreset = 'last_30d'): Promise<Campaign[]> {
  const url = `${META_API}/${accountId}/campaigns?fields=id,name,status,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&access_token=${token}&limit=50`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return (data.data || []).map((c: Record<string, unknown>) => {
    const insData = c.insights as { data: Record<string, unknown>[] } | undefined
    const ins = insData?.data?.[0]
    return { id: c.id, name: c.name, status: c.status, ...parseInsights(ins) }
  })
}

export async function fetchAdSets(token: string, campaignId: string, datePreset = 'last_30d'): Promise<AdSet[]> {
  const url = `${META_API}/${campaignId}/adsets?fields=id,name,status,targeting,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&access_token=${token}&limit=50`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return (data.data || []).map((s: Record<string, unknown>) => {
    const insData = s.insights as { data: Record<string, unknown>[] } | undefined
    const ins = insData?.data?.[0]
    return { id: s.id, name: s.name, status: s.status, targeting: s.targeting, ...parseInsights(ins) }
  })
}

export async function fetchAds(token: string, adsetId: string, datePreset = 'last_30d'): Promise<Ad[]> {
  const url = `${META_API}/${adsetId}/ads?fields=id,name,status,creative{title,body,image_url,call_to_action_type},insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}&access_token=${token}&limit=50`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return (data.data || []).map((a: Record<string, unknown>) => {
    const insData = a.insights as { data: Record<string, unknown>[] } | undefined
    const ins = insData?.data?.[0]
    const cr = a.creative as Record<string, unknown> | undefined
    return {
      id: a.id, name: a.name, status: a.status,
      creative: cr ? { title: cr.title as string, body: cr.body as string, image_url: cr.image_url as string, call_to_action: cr.call_to_action_type as string } : undefined,
      ...parseInsights(ins)
    }
  })
}

export async function fetchFullAccount(token: string, accountId: string, datePreset = 'last_30d'): Promise<Campaign[]> {
  const campaigns = await fetchCampaigns(token, accountId, datePreset)
  const enriched = await Promise.all(campaigns.map(async (c) => {
    try {
      const adsets = await fetchAdSets(token, c.id, datePreset)
      const adsetsWithAds = await Promise.all(adsets.map(async (s) => {
        try {
          const ads = await fetchAds(token, s.id, datePreset)
          return { ...s, ads }
        } catch { return s }
      }))
      return { ...c, adsets: adsetsWithAds }
    } catch { return c }
  }))
  return enriched
}
