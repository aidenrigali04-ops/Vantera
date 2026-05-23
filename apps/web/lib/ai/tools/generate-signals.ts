// Tool: generate-signals.
//
// Scans the live BusinessContext and produces a short list of proactive
// recommendations the owner should see today. Each recommendation lands in
// `intelligence_signals` so the dashboard can surface them, with a paired
// `signal_generated` observation for the learning loop.
//
// The point isn't to write a generic "you should follow up with leads" —
// it's to mine the SPECIFIC pipelines, automations, and metrics this account
// has and call out concrete actions.

import { db } from '@/lib/db/client'
import { intelligenceSignals } from '@vantera/db'
import { callModel, parseJsonResponse } from '../client'
import { toPromptContext, type BusinessContext } from '../context'
import { recordObservation } from '../memory'

const TOOL_NAME = 'generate-signals'
const MAX_SIGNALS = 5

export type SignalSeverity = 'red' | 'yellow' | 'green'

export type GeneratedSignal = {
  signalType: string
  severity: SignalSeverity
  headline: string
  recommendation: string
  actionLabel: string | null
  confidence: number
}

const SYSTEM_PROMPT = `You are the strategic advisor for a small services business. Looking at the
account's live state (pipelines, channels, automations, recent activity),
produce up to 5 SPECIFIC, ACTIONABLE recommendations.

Rules:
  * Each headline ≤ 90 characters. Each recommendation ≤ 240 characters.
  * Be specific: reference the actual pipeline names, automations, or
    metrics in the context. "Send more emails" is bad. "Re-enable the HVAC
    'estimate_followup_d3' automation that was created at onboarding but is
    still inactive" is good.
  * SEVERITY:
      red    — clear leak / problem costing money now
      yellow — likely improvement, not on fire
      green  — opportunity to expand what's working
  * Only emit signals with high confidence. Skip a slot rather than fill it
    with a generic recommendation.
  * SIGNAL TYPE is a short snake_case identifier (e.g. inactive_automation,
    stale_lead, missing_review_link, payment_overdue_pattern).
  * ACTION LABEL is the verb on the button the owner will click, ≤ 24 chars.

Return ONLY a JSON array (max 5 items):
[
  {
    "signalType": "...",
    "severity": "red" | "yellow" | "green",
    "headline": "...",
    "recommendation": "...",
    "actionLabel": "..." | null,
    "confidence": 0-100
  }
]`

export async function generateSignals(
  ctx: BusinessContext,
): Promise<{ ok: true; signals: GeneratedSignal[] } | { ok: false; reason: string }> {
  const userPrompt = [
    toPromptContext(ctx),
    '',
    `Today is ${new Date().toISOString().slice(0, 10)}. Produce up to ${MAX_SIGNALS} recommendations.`,
  ].join('\n')

  const result = await callModel({
    accountId: ctx.accountId,
    toolName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 1024,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  const parsed = parseJsonResponse<GeneratedSignal[]>(result.text, (raw) => {
    if (!Array.isArray(raw)) return null
    const list: GeneratedSignal[] = []
    for (const item of raw.slice(0, MAX_SIGNALS)) {
      if (!item || typeof item !== 'object') continue
      const r = item as Record<string, unknown>
      const severity = typeof r.severity === 'string' ? r.severity : null
      if (severity !== 'red' && severity !== 'yellow' && severity !== 'green') continue
      if (typeof r.signalType !== 'string' || r.signalType.length === 0) continue
      if (typeof r.headline !== 'string' || r.headline.length === 0) continue
      if (typeof r.recommendation !== 'string' || r.recommendation.length === 0) continue
      list.push({
        signalType: r.signalType,
        severity,
        headline: r.headline.slice(0, 200),
        recommendation: r.recommendation.slice(0, 500),
        actionLabel: typeof r.actionLabel === 'string' ? r.actionLabel.slice(0, 80) : null,
        confidence: typeof r.confidence === 'number' ? r.confidence : 50,
      })
    }
    return list
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  if (parsed.length === 0) {
    return { ok: true, signals: [] }
  }

  // Persist each signal. We don't dedupe — duplicates with low confidence will
  // age out naturally and the dashboard groups by signalType.
  const insertRows = parsed.map((s) => ({
    accountId: ctx.accountId,
    signalType: s.signalType,
    severity: s.severity,
    headline: s.headline,
    recommendation: s.recommendation,
    actionLabel: s.actionLabel,
    actionPayload: { generatedBy: TOOL_NAME, generatedAt: new Date().toISOString() },
    confidenceScore: s.confidence,
  }))

  const inserted = await db.insert(intelligenceSignals).values(insertRows).returning({
    id: intelligenceSignals.id,
  })

  for (let i = 0; i < inserted.length; i += 1) {
    const signal = inserted[i]
    const source = parsed[i]
    if (!signal || !source) continue
    await recordObservation({
      accountId: ctx.accountId,
      kind: 'signal_generated',
      payload: {
        tool: TOOL_NAME,
        severity: source.severity,
        signalType: source.signalType,
        confidence: source.confidence,
      },
      relatedSignalId: signal.id,
    })
  }

  return { ok: true, signals: parsed }
}
