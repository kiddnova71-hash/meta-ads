'use client'

import { useState, useEffect, useMemo } from 'react'

interface KBEntry {
  id: string
  summary: string
  key_takeaway: string
  category: string
  funnel_stage: string
  confidence: number
  comment_sentiment: string
  comment_notes: string
  applicable_to: string[]
  source_author: string
  source_url: string
  source_text: string
  reply_count: number
  likes: number
  date_scraped: string
}

interface KBData {
  last_updated: string
  entries: KBEntry[]
  stats: {
    total: number
    by_category: Record<string, number>
    avg_confidence: number
  }
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  creative_testing:   { bg: '#eff6ff', color: '#2563eb' },
  audience_targeting: { bg: '#f0fdf4', color: '#16a34a' },
  bidding_strategy:   { bg: '#fefce8', color: '#ca8a04' },
  campaign_structure: { bg: '#faf5ff', color: '#7c3aed' },
  scaling:            { bg: '#fff7ed', color: '#ea580c' },
  creative_fatigue:   { bg: '#fef2f2', color: '#dc2626' },
  creative_hooks:     { bg: '#ecfdf5', color: '#059669' },
  tracking:           { bg: '#f0f9ff', color: '#0284c7' },
  general:            { bg: '#f9fafb', color: '#6b7280' },
}

const SENTIMENT_ICONS: Record<string, string> = {
  validating: '✅',
  mixed: '⚠️',
  contradicting: '❌',
  no_comments: '💬',
}

const FUNNEL_LABELS: Record<string, string> = {
  TOF: 'Top of Funnel',
  MOF: 'Mid Funnel',
  BOF: 'Bottom of Funnel',
  full_funnel: 'Full Funnel',
  general: 'General',
}

export default function KnowledgePage() {
  const [data, setData] = useState<KBData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterFunnel, setFilterFunnel] = useState('all')
  const [sortBy, setSortBy] = useState<'confidence' | 'likes' | 'date'>('confidence')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/knowledge')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.entries
      .filter(e => {
        const q = search.toLowerCase()
        const matchSearch = !q || e.summary.toLowerCase().includes(q) || e.key_takeaway.toLowerCase().includes(q) || e.category.includes(q) || e.source_author.toLowerCase().includes(q)
        const matchCat = filterCategory === 'all' || e.category === filterCategory
        const matchFunnel = filterFunnel === 'all' || e.funnel_stage === filterFunnel
        return matchSearch && matchCat && matchFunnel
      })
      .sort((a, b) => {
        if (sortBy === 'confidence') return b.confidence - a.confidence
        if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0)
        return b.date_scraped.localeCompare(a.date_scraped)
      })
  }, [data, search, filterCategory, filterFunnel, sortBy])

  const inputStyle = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 13, outline: 'none', background: '#fff', color: '#111'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b7280', fontSize: 14 }}>
      Loading knowledge base...
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: '#b91c1c', fontSize: 13 }}>
      Error: {error}
      <div style={{ marginTop: 8, color: '#6b7280' }}>Make sure GITHUB_REPO is set in your Vercel env variables.</div>
    </div>
  )

  const categories = data ? Object.keys(data.stats.by_category) : []

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>🧠 Ads Knowledge Base</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {data?.stats.total} strategies · avg confidence {((data?.stats.avg_confidence || 0) * 100).toFixed(0)}% · last updated {data?.last_updated?.slice(0, 10)}
              </div>
            </div>
            <a href="/" style={{ padding: '8px 16px', background: '#1877F2', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              ← Back to dashboard
            </a>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(data?.stats.by_category || {}).map(([cat, count]) => {
              const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                  style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: filterCategory === cat ? c.color : c.bg,
                    color: filterCategory === cat ? '#fff' : c.color,
                    border: `1px solid ${c.color}40`, cursor: 'pointer'
                  }}
                >
                  {cat.replace(/_/g, ' ')} ({count})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, minWidth: 240, flex: 1 }}
            placeholder="Search strategies, categories, authors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={inputStyle} value={filterFunnel} onChange={e => setFilterFunnel(e.target.value)}>
            <option value="all">All funnel stages</option>
            {['TOF', 'MOF', 'BOF', 'full_funnel', 'general'].map(f => (
              <option key={f} value={f}>{FUNNEL_LABELS[f]}</option>
            ))}
          </select>
          <select style={inputStyle} value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="confidence">Sort: Confidence</option>
            <option value="likes">Sort: Likes</option>
            <option value="date">Sort: Date</option>
          </select>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} results</span>
        </div>
      </div>

      {/* Entries */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>
            No strategies match your filters.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map(e => {
              const c = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.general
              const isOpen = expanded === e.id
              const confPct = Math.round(e.confidence * 100)
              const confColor = e.confidence >= 0.8 ? '#16a34a' : e.confidence >= 0.6 ? '#ca8a04' : '#dc2626'

              return (
                <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start' }}
                  >
                    {/* Confidence circle */}
                    <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', border: `3px solid ${confColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: confColor, lineHeight: 1 }}>{confPct}</span>
                      <span style={{ fontSize: 8, color: '#9ca3af' }}>conf</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.color }}>
                          {e.category.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280' }}>
                          {FUNNEL_LABELS[e.funnel_stage] || e.funnel_stage}
                        </span>
                        <span style={{ fontSize: 11 }} title={e.comment_sentiment}>
                          {SENTIMENT_ICONS[e.comment_sentiment]}
                        </span>
                        {e.source_author && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{e.source_author}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.5, marginBottom: 4 }}>
                        {e.summary}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        💡 {e.key_takeaway}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {e.likes > 0 && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>♥ {e.likes}</span>
                      )}
                      <span style={{ fontSize: 18, color: '#d1d5db' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '0 20px 16px', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Original post</div>
                          <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', background: '#f9fafb', padding: '10px 12px', borderRadius: 8, lineHeight: 1.6 }}>
                            "{e.source_text}"
                          </div>
                          {e.source_url && (
                            <a href={e.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1877F2', marginTop: 4, display: 'inline-block' }}>
                              View on X →
                            </a>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Comment analysis</div>
                          <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', padding: '10px 12px', borderRadius: 8, lineHeight: 1.6 }}>
                            {SENTIMENT_ICONS[e.comment_sentiment]} <strong>{e.comment_sentiment}</strong>
                            <br />
                            {e.comment_notes || 'No comment data available'}
                          </div>
                          <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                            {e.reply_count} replies · scraped {e.date_scraped}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
