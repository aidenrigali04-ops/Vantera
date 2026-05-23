// Tool: summarize-business-context.
//
// Generates a concise account-level "what we know about this business"
// summary and writes it to `ai_memory` under kind='business_context'. This is
// the seed document that every other tool reads via `loadBusinessContext()`
// so its quality compounds — better summaries here mean better drafts,
// classifications, and signals downstream.
//
// Run after onboarding completes, and re-run nightly so the document evolves
// as the business uses the product.

import { callModel, parseJsonResponse } from '../client'
import { toPromptContext, type BusinessContext } from '../context'
import { upsertMemory } from '../memory'

const TOOL_NAME = 'summarize-business-context'

export type SummarizeOutput = {
  summary: string
  keyTraits: string[]
  riskFactors: string[]
  opportunities: string[]
  confidence: number
}

const SYSTEM_PROMPT = `You are the strategic memory of a CRM. Given the live state of a business
account, write a tight one-paragraph summary of what kind of operation this
is, who the customer is, what's working, and where they need help. Then list
3-5 KEY TRAITS, up to 3 RISK FACTORS, and up to 3 OPPORTUNITIES.

Be specific and operational, not generic. Reference channels, pipelines, and
activity volume from the provided context. If the account has zero activity,
say so plainly and let downstream tools handle the cold-start.

Return ONLY a JSON object of the form:
{
  "summary": "...",
  "keyTraits": ["...", "..."],
  "riskFactors": ["...", "..."],
  "opportunities": ["...", "..."],
  "confidence": 0-100
}
No prose, no markdown, no code fences. JSON only.`

export async function summarizeBusinessContext(
  ctx: BusinessContext,
): Promise<{ ok: true; output: SummarizeOutput } | { ok: false; reason: string }> {
  const userPrompt = [
    toPromptContext(ctx),
    '',
    'Produce the JSON summary now.',
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

  const parsed = parseJsonResponse<SummarizeOutput>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.summary !== 'string' || r.summary.length === 0) return null
    return {
      summary: r.summary,
      keyTraits: Array.isArray(r.keyTraits) ? r.keyTraits.filter((s) => typeof s === 'string') : [],
      riskFactors: Array.isArray(r.riskFactors)
        ? r.riskFactors.filter((s) => typeof s === 'string')
        : [],
      opportunities: Array.isArray(r.opportunities)
        ? r.opportunities.filter((s) => typeof s === 'string')
        : [],
      confidence: typeof r.confidence === 'number' ? r.confidence : 50,
    }
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  await upsertMemory({
    accountId: ctx.accountId,
    kind: 'business_context',
    subjectType: 'account',
    subjectId: ctx.accountId,
    summary: parsed.summary,
    evidence: {
      keyTraits: parsed.keyTraits,
      riskFactors: parsed.riskFactors,
      opportunities: parsed.opportunities,
      metricsSnapshot: ctx.metrics,
    },
    confidence: parsed.confidence,
    modelUsed: result.model,
  })

  return { ok: true, output: parsed }
}
