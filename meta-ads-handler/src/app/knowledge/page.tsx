"use client"
import { useState } from "react"

interface Strategy {
  id: string
  summary: string
  key_takeaway: string
  category: string
  funnel_stage: string
  confidence: number
  source_author: string
  source_url: string
  date_scraped: string
  comment_sentiment: string
  applicable_to: string[]
}

interface KnowledgeBase {
  version: number
  last_updated: string
  entries: Strategy[]
  stats: Record<string, unknown>
}

const CATEGORIES = [
  "creative_testing", "audience_targeting", "bidding_strategy",
  "campaign_structure", "scaling", "creative_fatigue",
  "budget_strategy", "creative_hooks", "tracking", "general"
]

const FUNNEL_STAGES = ["TOF", "MOF", "BOF", "full_funnel", "general"]

const EMPTY_FORM = {
  summary: "",
  key_takeaway: "",
  category: "creative_testing",
  funnel_stage: "TOF",
  confidence: 0.9,
  source_author: "",
  source_url: "",
  comment_sentiment: "validating",
}

export default function KnowledgePage() {
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function loadKB() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/knowledge")
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setKb(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge base")
    } finally {
      setLoading(false)
    }
  }

  async function saveKB(updated: KnowledgeBase) {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      setKb(data)
      setSuccess("Saved successfully!")
      setTimeout(() => setSuccess(""), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function addStrategy() {
    if (!kb) return
    if (!form.summary || !form.key_takeaway) {
      setError("Summary and key takeaway are required")
      return
    }
    const newEntry: Strategy = {
      id: Date.now().toString(36),
      summary: form.summary,
      key_takeaway: form.key_takeaway,
      category: form.category,
      funnel_stage: form.funnel_stage,
      confidence: form.confidence,
      source_author: form.source_author || "Manual entry",
      source_url: form.source_url || "",
      comment_sentiment: form.comment_sentiment,
      applicable_to: ["ecommerce"],
      date_scraped: new Date().toISOString().split("T")[0],
    }
    const updated = { ...kb, entries: [newEntry, ...kb.entries] }
    saveKB(updated)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function deleteStrategy(id: string) {
    if (!kb) return
    const updated = { ...kb, entries: kb.entries.filter(e => e.id !== id) }
    saveKB(updated)
    setDeleteId(null)
  }

  const filtered = kb?.entries.filter(e =>
    filter === "all" || e.category === filter
  ) || []

  const categoryColors: Record<string, string> = {
    creative_testing: "#3b82f6", audience_targeting: "#8b5cf6",
    bidding_strategy: "#f59e0b", campaign_structure: "#10b981",
    scaling: "#ef4444", creative_fatigue: "#f97316",
    budget_strategy: "#06b6d4", creative_hooks: "#ec4899",
    tracking: "#6366f1", general: "#6b7280"
  }

  const confidenceColor = (c: number) =>
    c >= 0.8 ? "#16a34a" : c >= 0.6 ? "#d97706" : "#dc2626"

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111" }}>Knowledge Base</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            {kb ? `${kb.entries.length} strategies` : "Your Meta Ads strategy library"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!kb && (
            <button onClick={loadKB} disabled={loading}
              style={{ padding: "8px 16px", background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              {loading ? "Loading..." : "Load Knowledge Base"}
            </button>
          )}
          {kb && (
            <button onClick={() => { setShowForm(!showForm); setError("") }}
              style={{ padding: "8px 16px", background: showForm ? "#f3f4f6" : "#1877F2", color: showForm ? "#374151" : "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              {showForm ? "Cancel" : "+ Add Strategy"}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{success}</div>}

      {/* Stats */}
      {kb && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Strategies", value: kb.entries.length },
            { label: "Avg Confidence", value: kb.entries.length ? (kb.entries.reduce((a, e) => a + e.confidence, 0) / kb.entries.length * 100).toFixed(0) + "%" : "—" },
            { label: "Last Updated", value: kb.last_updated ? new Date(kb.last_updated).toLocaleDateString() : "Never" },
          ].map(s => (
            <div key={s.label} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showForm && kb && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Add New Strategy</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Summary *</label>
              <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
                placeholder="Describe the strategy in 1-2 sentences..."
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, minHeight: 70, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Key Takeaway *</label>
              <input value={form.key_takeaway} onChange={e => setForm({ ...form, key_takeaway: e.target.value })}
                placeholder="The single most actionable thing..."
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Funnel Stage</label>
                <select value={form.funnel_stage} onChange={e => setForm({ ...form, funnel_stage: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}>
                  {FUNNEL_STAGES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Source (name/channel)</label>
                <input value={form.source_author} onChange={e => setForm({ ...form, source_author: e.target.value })}
                  placeholder="e.g. My own testing / @BenHeath / YouTube"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Source URL (optional)</label>
                <input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })}
                  placeholder="https://..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Confidence: {Math.round(form.confidence * 100)}%
              </label>
              <input type="range" min={0.5} max={1} step={0.05} value={form.confidence}
                onChange={e => setForm({ ...form, confidence: parseFloat(e.target.value) })}
                style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                <span>Unproven</span><span>Somewhat proven</span><span>Highly proven</span>
              </div>
            </div>
            <button onClick={addStrategy} disabled={saving}
              style={{ padding: "10px 20px", background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, alignSelf: "flex-start" }}>
              {saving ? "Saving..." : "Add to Knowledge Base"}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {kb && kb.entries.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {["all", ...CATEGORIES.filter(c => kb.entries.some(e => e.category === c))].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ padding: "5px 12px", background: filter === cat ? "#1877F2" : "#f3f4f6", color: filter === cat ? "#fff" : "#374151", border: "none", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: filter === cat ? 600 : 400 }}>
              {cat === "all" ? "All" : cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      {/* Entries */}
      {kb && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>No strategies yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Add your own strategies using the button above</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map(entry => (
          <div key={entry.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ background: categoryColors[entry.category] || "#6b7280", color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>
                  {entry.category.replace(/_/g, " ")}
                </span>
                <span style={{ background: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>
                  {entry.funnel_stage}
                </span>
                <span style={{ background: "#f0fdf4", color: confidenceColor(entry.confidence), fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                  {Math.round(entry.confidence * 100)}% confidence
                </span>
              </div>
              <button onClick={() => setDeleteId(entry.id)}
                style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>
                ×
              </button>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#111", lineHeight: 1.5 }}>{entry.summary}</p>
            <div style={{ background: "#eff6ff", borderLeft: "3px solid #1877F2", padding: "8px 12px", borderRadius: "0 6px 6px 0", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1877F2", textTransform: "uppercase" }}>Key Takeaway</span>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#1e40af" }}>{entry.key_takeaway}</p>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#9ca3af" }}>
              <span>📌 {entry.source_author}</span>
              <span>📅 {entry.date_scraped}</span>
              {entry.source_url && <a href={entry.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#1877F2" }}>View source</a>}
            </div>

            {/* Delete confirm */}
            {deleteId === entry.id && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.95)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexDirection: "column" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Delete this strategy?</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => deleteStrategy(entry.id)}
                    style={{ padding: "6px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                    Delete
                  </button>
                  <button onClick={() => setDeleteId(null)}
                    style={{ padding: "6px 16px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!kb && !loading && (
        <div style={{ textAlign: "center", padding: 64, color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Knowledge Base</div>
          <div style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>Load your strategy library to view, add, and manage strategies</div>
          <button onClick={loadKB}
            style={{ padding: "10px 24px", background: "#1877F2", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
            Load Knowledge Base
          </button>
        </div>
      )}
    </div>
  )
}
