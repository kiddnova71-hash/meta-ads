'use client'

import { useState, useCallback } from 'react'
import type { Campaign } from '@/lib/meta'
import type { AnalysisResult, Suggestion } from '@/lib/analyze'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'connect' | 'campaigns' | 'analysis' | 'alerts'

interface Settings {
  token: string
  accountId: string
  accountName: string
  datePreset: string
  accountType: string
  goals: string
  slackWebhook: string
  emailTo: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthScore(c: Campaign) {
  let s = 50
  if (c.roas >= 4) s += 20; else if (c.roas >= 2.5) s += 10; else if (c.roas < 1.5) s -= 20
  if (c.ctr >= 2.5) s += 15; else if (c.ctr >= 1.5) s += 5; else if (c.ctr < 0.8) s -= 15
  if (c.frequency > 5) s -= 20; else if (c.frequency > 3.5) s -= 8
  return Math.max(5, Math.min(100, s))
}

function scoreColor(s: number) {
  return s >= 70 ? '#16a34a' : s >= 45 ? '#ca8a04' : '#dc2626'
}

function fmt(n: number, prefix = '') {
  if (n >= 1000000) return prefix + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return prefix + (n / 1000).toFixed(1) + 'K'
  return prefix + n.toLocaleString()
}

const PRIORITY_COLORS: Record<string, string> = { high: '#dc2626', medium: '#ca8a04', low: '#16a34a' }
const TYPE_COLORS: Record<string, string> = { scale: '#16a34a', pause: '#dc2626', test: '#2563eb', fix: '#ca8a04', creative: '#7c3aed' }
const TYPE_LABELS: Record<string, string> = { scale: '↑ Scale signal', pause: '⏸ Consider pausing', test: '⚗ Run a test', fix: '⚙ Fix needed', creative: '✦ Creative change' }

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: bg, color, display: 'inline-block' }}>
      {children}
    </span>
  )
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: open ? '#fafafa' : '#fff' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{s.title}</span>
            <Badge color={PRIORITY_COLORS[s.priority]} bg={PRIORITY_COLORS[s.priority] + '18'}>{s.priority.toUpperCase()}</Badge>
            <Badge color={TYPE_COLORS[s.type]} bg={TYPE_COLORS[s.type] + '18'}>{TYPE_LABELS[s.type]}</Badge>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {s.campaign}{s.adset ? ` → ${s.adset}` : ''}{s.ad ? ` → ${s.ad}` : ''}
            {s.metric && <span style={{ marginLeft: 8, fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, color: '#374151' }}>{s.metric}</span>}
          </div>
        </div>
        <span style={{ color: '#9ca3af', fontSize: 18, marginLeft: 12, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '14px 18px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>{s.detail}</div>
          <div style={{ fontSize: 12, color: '#6b7280', paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
            <strong>Expected impact:</strong> {s.impact}
          </div>
        </div>
      )}
    </div>
  )
}

function CampaignRow({ c, onExpand, expanded }: { c: Campaign; onExpand: () => void; expanded: boolean }) {
  const score = healthScore(c)
  const statusColors: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: '#dcfce7', color: '#15803d' },
    PAUSED: { bg: '#f3f4f6', color: '#6b7280' },
    ARCHIVED: { bg: '#fee2e2', color: '#b91c1c' }
  }
  const sc = statusColors[c.status] || { bg: '#f3f4f6', color: '#6b7280' }

  return (
    <>
      <tr
        onClick={onExpand}
        style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
        className="hover-row"
      >
        <td style={{ padding: '12px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>{c.name}</div>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: sc.bg, color: sc.color }}>{c.status}</span>
        </td>
        <td style={{ padding: '12px 8px', fontSize: 13, color: '#374151' }}>${fmt(c.spend)}</td>
        <td style={{ padding: '12px 8px', fontSize: 13, color: c.roas >= 3 ? '#15803d' : c.roas < 1.5 ? '#b91c1c' : '#374151', fontWeight: c.roas >= 3 ? 600 : 400 }}>{c.roas.toFixed(2)}x</td>
        <td style={{ padding: '12px 8px', fontSize: 13, color: '#374151' }}>{c.ctr.toFixed(2)}%</td>
        <td style={{ padding: '12px 8px', fontSize: 13, color: c.frequency > 5 ? '#b91c1c' : c.frequency > 3.5 ? '#ca8a04' : '#374151' }}>{c.frequency.toFixed(1)}</td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 2 }}>
              <div style={{ width: `${score}%`, height: 4, background: scoreColor(score), borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(score), minWidth: 24 }}>{score}</span>
          </div>
        </td>
        <td style={{ padding: '12px 8px', fontSize: 13, color: '#9ca3af' }}>{expanded ? '▲' : c.adsets?.length ? '▼' : ''}</td>
      </tr>
      {expanded && c.adsets?.map(s => (
        <tr key={s.id} style={{ borderBottom: '1px solid #f9fafb', background: '#fafafa' }}>
          <td style={{ padding: '10px 16px 10px 32px', fontSize: 12, color: '#374151' }}>
            <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Ad set</div>
            {s.name}
          </td>
          <td style={{ padding: '10px 8px', fontSize: 12, color: '#6b7280' }}>${fmt(s.spend)}</td>
          <td style={{ padding: '10px 8px', fontSize: 12, color: s.roas >= 3 ? '#15803d' : s.roas < 1.5 ? '#b91c1c' : '#6b7280' }}>{s.roas.toFixed(2)}x</td>
          <td style={{ padding: '10px 8px', fontSize: 12, color: '#6b7280' }}>{s.ctr.toFixed(2)}%</td>
          <td style={{ padding: '10px 8px', fontSize: 12, color: s.frequency > 5 ? '#b91c1c' : '#6b7280' }}>{s.frequency.toFixed(1)}</td>
          <td colSpan={2} style={{ padding: '10px 8px', fontSize: 12, color: '#9ca3af' }}>{s.conversions} conv.</td>
        </tr>
      ))}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [tab, setTab] = useState<Tab>('connect')
  const [settings, setSettings] = useState<Settings>({
    token: '', accountId: '', accountName: 'My Ad Account',
    datePreset: 'last_30d', accountType: 'ecommerce', goals: '',
    slackWebhook: '', emailTo: '', smtpHost: 'smtp.gmail.com',
    smtpPort: '587', smtpUser: '', smtpPass: ''
  })
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [error, setError] = useState('')
  const [alertMsg, setAlertMsg] = useState('')
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)
  const [manualData, setManualData] = useState('')

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setSettings(s => ({ ...s, [k]: e.target.value }))

  const loadCampaigns = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (manualData.trim()) {
        const parsed = JSON.parse(manualData)
        setCampaigns(parsed)
        setTab('campaigns')
        setLoading(false)
        return
      }
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.token, accountId: settings.accountId, datePreset: settings.datePreset })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCampaigns(data.campaigns)
      setTab('campaigns')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns')
    }
    setLoading(false)
  }, [settings, manualData])

  const runAnalysis = useCallback(async () => {
    if (!campaigns.length) { setError('Load campaigns first'); return }
    setLoading(true); setError(''); setTab('analysis')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns, goals: settings.goals, accountType: settings.accountType })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    }
    setLoading(false)
  }, [campaigns, settings])

  const testAlert = useCallback(async () => {
    setAlertLoading(true); setAlertMsg('')
    try {
      const res = await fetch('/api/alert-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slackWebhook: settings.slackWebhook,
          emailTo: settings.emailTo,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPass: settings.smtpPass,
          accountName: settings.accountName
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAlertMsg('Test alert sent successfully! Check your Slack / inbox.')
    } catch (e: unknown) {
      setAlertMsg('Error: ' + (e instanceof Error ? e.message : 'Failed'))
    }
    setAlertLoading(false)
  }, [settings])

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalRev = campaigns.reduce((s, c) => s + c.revenue, 0)
  const blendedROAS = totalSpend > 0 ? totalRev / totalSpend : 0
  const avgCTR = campaigns.length ? campaigns.reduce((s, c) => s + c.ctr, 0) / campaigns.length : 0

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 13, color: '#111', background: '#fff'
  }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' as const }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'connect', label: 'Connect' },
    { id: 'campaigns', label: `Campaigns${campaigns.length ? ` (${campaigns.length})` : ''}` },
    { id: 'analysis', label: 'AI Analysis' },
    { id: 'alerts', label: 'Daily Alerts' }
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <style>{`.hover-row:hover { background: #fafafa; } .tab-btn { transition: all 0.15s; }`}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#1877F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Meta Ads AI Handler</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Analysis & daily alerts</div>
            </div>
          </div>
          {campaigns.length > 0 && (
            <button
              onClick={runAnalysis}
              style={{ padding: '8px 18px', background: '#1877F2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading && tab === 'analysis' ? 'Analyzing...' : 'Run AI analysis →'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="tab-btn"
              style={{
                padding: '12px 18px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? '#1877F2' : '#6b7280',
                background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #1877F2' : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1
              }}
            >
              {t.label}
            </button>
          ))}
          <a
            href="/knowledge"
            style={{
              padding: '12px 18px', fontSize: 13, fontWeight: 400,
              color: '#6b7280', textDecoration: 'none',
              borderBottom: '2px solid transparent', marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 5
            }}
          >
            Knowledge Base
            <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>NEW</span>
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── CONNECT TAB ── */}
        {tab === 'connect' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Meta API connection</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                Go to <strong>Meta Business Suite → Settings → Users → System Users</strong>, create a system user, assign it to your Ad Account with Advertiser role, and generate a token with <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>ads_read</code> permission.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Access token</label>
                  <input style={inputStyle} type="password" value={settings.token} onChange={set('token')} placeholder="EAAxxxxx..." />
                </div>
                <div>
                  <label style={labelStyle}>Ad Account ID</label>
                  <input style={inputStyle} value={settings.accountId} onChange={set('accountId')} placeholder="act_1234567890" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Date range</label>
                    <select style={inputStyle} value={settings.datePreset} onChange={set('datePreset')}>
                      <option value="last_7d">Last 7 days</option>
                      <option value="last_14d">Last 14 days</option>
                      <option value="last_30d">Last 30 days</option>
                      <option value="last_90d">Last 90 days</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Account type</label>
                    <select style={inputStyle} value={settings.accountType} onChange={set('accountType')}>
                      <option value="ecommerce">Ecommerce / DTC</option>
                      <option value="lead-gen">Lead generation</option>
                      <option value="app">App installs</option>
                      <option value="b2b">B2B / SaaS</option>
                      <option value="local">Local business</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Account name (for alerts)</label>
                  <input style={inputStyle} value={settings.accountName} onChange={set('accountName')} placeholder="My Brand" />
                </div>
                <div>
                  <label style={labelStyle}>Goals & context (optional)</label>
                  <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={settings.goals} onChange={set('goals')} placeholder="E.g. Target ROAS 4x, AOV $120, CAC target $30, main objective is scaling..." />
                </div>
                <button
                  onClick={loadCampaigns}
                  disabled={loading}
                  style={{ padding: '10px 0', background: '#1877F2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Connecting...' : 'Connect & load campaigns →'}
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Or paste campaign data</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>Export from Meta Ads Manager and paste as JSON, or describe your campaigns in plain text.</div>
              <textarea
                style={{ ...inputStyle, minHeight: 280, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                value={manualData}
                onChange={e => setManualData(e.target.value)}
                placeholder={`[
  {
    "name": "Brand Awareness Q2",
    "status": "ACTIVE",
    "spend": 4200,
    "revenue": 14700,
    "roas": 3.5,
    "impressions": 180000,
    "clicks": 3600,
    "ctr": 2.0,
    "cpc": 1.17,
    "frequency": 2.1,
    "conversions": 84
  }
]`}
              />
              <button
                onClick={loadCampaigns}
                disabled={loading || !manualData.trim()}
                style={{ marginTop: 12, width: '100%', padding: '10px 0', background: '#374151', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading || !manualData.trim() ? 'not-allowed' : 'pointer', opacity: loading || !manualData.trim() ? 0.5 : 1 }}
              >
                Load manual data →
              </button>
            </div>
          </div>
        )}

        {/* ── CAMPAIGNS TAB ── */}
        {tab === 'campaigns' && (
          <div>
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>No campaigns loaded</div>
                <div style={{ fontSize: 13 }}>Go to Connect tab to load your campaigns</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  <MetricCard label="Total spend" value={'$' + fmt(totalSpend)} />
                  <MetricCard label="Total revenue" value={'$' + fmt(totalRev)} />
                  <MetricCard label="Blended ROAS" value={blendedROAS.toFixed(2) + 'x'} />
                  <MetricCard label="Avg CTR" value={avgCTR.toFixed(2) + '%'} sub={campaigns.length + ' campaigns'} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {['Campaign', 'Spend', 'ROAS', 'CTR', 'Freq.', 'Health', ''].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => (
                        <CampaignRow
                          key={c.id || c.name}
                          c={c}
                          expanded={expandedCampaign === (c.id || c.name)}
                          onExpand={() => setExpandedCampaign(p => p === (c.id || c.name) ? null : (c.id || c.name))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={runAnalysis}
                    style={{ padding: '10px 24px', background: '#1877F2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Analyze with AI →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ANALYSIS TAB ── */}
        {tab === 'analysis' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#1877F2',
                      animation: 'pulse 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`
                    }} />
                  ))}
                </div>
                <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Analyzing your campaigns with Claude AI...</div>
              </div>
            ) : !analysis ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Ready to analyze</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>Load campaigns first, then click the button below</div>
                <button
                  onClick={runAnalysis}
                  disabled={!campaigns.length}
                  style={{ padding: '10px 24px', background: '#1877F2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: campaigns.length ? 'pointer' : 'not-allowed', opacity: campaigns.length ? 1 : 0.5 }}
                >
                  Run AI analysis →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Account assessment</div>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{analysis.summary}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 12 }}>Generated {new Date(analysis.generatedAt).toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor(analysis.score), lineHeight: 1 }}>{analysis.score}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Health score / 100</div>
                    <div style={{ width: '100%', height: 6, background: '#f3f4f6', borderRadius: 3, marginTop: 4 }}>
                      <div style={{ width: `${analysis.score}%`, height: 6, background: scoreColor(analysis.score), borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#dc2626' }}>● {analysis.suggestions.filter(s => s.priority === 'high').length} high</span>
                      <span style={{ fontSize: 11, color: '#ca8a04' }}>● {analysis.suggestions.filter(s => s.priority === 'medium').length} med</span>
                      <span style={{ fontSize: 11, color: '#16a34a' }}>● {analysis.suggestions.filter(s => s.priority === 'low').length} low</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Recommendations ({analysis.suggestions.length})
                </div>
                {analysis.suggestions.map((s, i) => <SuggestionCard key={i} s={s} />)}

                <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                  <button
                    onClick={runAnalysis}
                    style={{ padding: '10px 20px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Re-analyze ↻
                  </button>
                  <button
                    onClick={() => setTab('alerts')}
                    style={{ padding: '10px 20px', background: '#1877F2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set up daily alerts →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {tab === 'alerts' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, background: '#4a154b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 16 }}>💬</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Slack alerts</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Daily digest to your channel</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
                In Slack: <strong>Apps → Incoming Webhooks → Add</strong>, choose a channel, copy the webhook URL.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Webhook URL</label>
                <input style={inputStyle} type="password" value={settings.slackWebhook} onChange={set('slackWebhook')} placeholder="https://hooks.slack.com/services/..." />
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, background: '#ea4335', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 16 }}>✉️</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Email alerts</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Beautiful daily email report</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Send to (email)</label>
                  <input style={inputStyle} type="email" value={settings.emailTo} onChange={set('emailTo')} placeholder="you@yourbrand.com" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>SMTP host</label>
                    <input style={inputStyle} value={settings.smtpHost} onChange={set('smtpHost')} placeholder="smtp.gmail.com" />
                  </div>
                  <div>
                    <label style={labelStyle}>Port</label>
                    <input style={inputStyle} value={settings.smtpPort} onChange={set('smtpPort')} placeholder="587" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>SMTP username</label>
                  <input style={inputStyle} value={settings.smtpUser} onChange={set('smtpUser')} placeholder="you@gmail.com" />
                </div>
                <div>
                  <label style={labelStyle}>SMTP password / app password</label>
                  <input style={inputStyle} type="password" value={settings.smtpPass} onChange={set('smtpPass')} placeholder="App password (not your Gmail password)" />
                </div>
              </div>
            </div>

            <div style={{ gridColumn: '1/-1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Daily schedule</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, marginBottom: 16 }}>
                Alerts run automatically every day at <strong>7:00 AM UTC</strong> via Vercel Cron. The cron pulls your latest 7-day data, runs the AI analysis, and sends the digest. No action needed once deployed.
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12, color: '#374151', marginBottom: 16 }}>
                <div style={{ color: '#9ca3af', marginBottom: 4 }}># Add these to your Vercel environment variables:</div>
                <div>META_ACCESS_TOKEN=your_token</div>
                <div>META_AD_ACCOUNT_ID=act_xxxxxxxx</div>
                <div>ANTHROPIC_API_KEY=sk-ant-...</div>
                <div>SLACK_WEBHOOK_URL=https://hooks.slack.com/...</div>
                <div>ALERT_EMAIL_TO=you@yourbrand.com</div>
                <div>SMTP_HOST=smtp.gmail.com</div>
                <div>SMTP_PORT=587</div>
                <div>SMTP_USER=you@gmail.com</div>
                <div>SMTP_PASS=your_app_password</div>
                <div>ACCOUNT_NAME=My Brand</div>
                <div>ACCOUNT_GOALS=Target ROAS 4x, CAC under $30</div>
                <div>CRON_SECRET=any_random_string</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={testAlert}
                  disabled={alertLoading || (!settings.slackWebhook && !settings.emailTo)}
                  style={{ padding: '10px 20px', background: '#1877F2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: alertLoading || (!settings.slackWebhook && !settings.emailTo) ? 0.5 : 1 }}
                >
                  {alertLoading ? 'Sending...' : 'Send test alert →'}
                </button>
                {alertMsg && (
                  <div style={{ fontSize: 13, color: alertMsg.startsWith('Error') ? '#b91c1c' : '#16a34a', fontWeight: 500 }}>
                    {alertMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
