import nodemailer from 'nodemailer'
import type { AnalysisResult, Suggestion } from './analyze'

function priorityEmoji(p: string) {
  return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢'
}

function typeLabel(t: string) {
  const m: Record<string, string> = { scale: '📈 Scale signal', pause: '⏸ Consider pausing', test: '🧪 Run a test', fix: '🔧 Fix needed', creative: '🎨 Creative change' }
  return m[t] || t
}

function scoreBar(score: number) {
  const filled = Math.round(score / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${score}/100`
}

// ── Slack ──────────────────────────────────────────────────────────────────

export async function sendSlackAlert(webhookUrl: string, result: AnalysisResult, accountName: string) {
  const high = result.suggestions.filter(s => s.priority === 'high')
  const med = result.suggestions.filter(s => s.priority === 'medium')

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📊 Meta Ads Daily Report — ${accountName}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Account health:* ${scoreBar(result.score)}\n\n${result.summary}` }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${high.length} high priority · ${med.length} medium priority · ${result.suggestions.length - high.length - med.length} low priority*` }
    },
    ...result.suggestions.slice(0, 8).map((s: Suggestion) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${priorityEmoji(s.priority)} *${s.title}*\n${typeLabel(s.type)}${s.metric ? ` · \`${s.metric}\`` : ''}\n${s.detail}\n_Impact: ${s.impact}_`
      }
    })),
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Generated ${new Date(result.generatedAt).toLocaleString()} · Meta Ads AI Handler` }]
    }
  ]

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks })
  })

  if (!res.ok) throw new Error(`Slack error: ${res.status} ${await res.text()}`)
}

// ── Email ──────────────────────────────────────────────────────────────────

export async function sendEmailAlert(
  smtpConfig: { host: string; port: number; user: string; pass: string },
  to: string,
  result: AnalysisResult,
  accountName: string
) {
  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass }
  })

  const priorityColor: Record<string, string> = { high: '#dc2626', medium: '#ca8a04', low: '#16a34a' }
  const typeColor: Record<string, string> = { scale: '#16a34a', pause: '#dc2626', test: '#2563eb', fix: '#ca8a04', creative: '#7c3aed' }

  const suggestionsHtml = result.suggestions.map((s: Suggestion) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
        <div>
          <strong style="font-size:14px;color:#111;">${s.title}</strong>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">${s.campaign}${s.adset ? ' → ' + s.adset : ''}${s.ad ? ' → ' + s.ad : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px;">
          <span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${priorityColor[s.priority]}22;color:${priorityColor[s.priority]};font-weight:600;">${s.priority.toUpperCase()}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${typeColor[s.type]}22;color:${typeColor[s.type]};font-weight:600;">${s.type.toUpperCase()}</span>
        </div>
      </div>
      ${s.metric ? `<div style="font-size:12px;font-family:monospace;background:#f3f4f6;padding:4px 8px;border-radius:4px;margin-bottom:8px;color:#374151;">${s.metric}</div>` : ''}
      <div style="font-size:13px;color:#374151;line-height:1.6;">${s.detail}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:8px;padding-top:8px;border-top:1px solid #f3f4f6;">Expected impact: ${s.impact}</div>
    </div>
  `).join('')

  const scorePercent = result.score
  const scoreColor = scorePercent >= 70 ? '#16a34a' : scorePercent >= 45 ? '#ca8a04' : '#dc2626'
  const date = new Date(result.generatedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:white;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1877F2;padding:24px 28px;color:white;">
      <div style="font-size:20px;font-weight:600;margin-bottom:4px;">📊 Meta Ads Daily Report</div>
      <div style="font-size:13px;opacity:0.85;">${accountName} · ${date}</div>
    </div>
    <div style="padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px 20px;background:#f9fafb;border-radius:8px;">
        <div style="text-align:center;">
          <div style="font-size:32px;font-weight:700;color:${scoreColor};">${result.score}</div>
          <div style="font-size:11px;color:#6b7280;">Health score</div>
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.7;flex:1;">${result.summary}</div>
      </div>
      <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Recommendations (${result.suggestions.length})</div>
      ${suggestionsHtml}
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Meta Ads AI Handler · Powered by Claude · Budget changes require human approval
    </div>
  </div>
</body></html>`

  await transport.sendMail({
    from: `"Meta Ads AI" <${smtpConfig.user}>`,
    to,
    subject: `📊 Meta Ads Daily Report — ${accountName} (Score: ${result.score}/100)`,
    html
  })
}
