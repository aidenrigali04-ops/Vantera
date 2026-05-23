// Tool: score-record.
//
// Estimates close probability and churn risk for an open pipeline record,
// returning a structured score with reasoning. Persists the result to
// `records.close_probability` and writes a `prediction_made` observation so
// the learning loop can later compare the prediction to the actual outcome.

import { db } from '@/lib/db/client'
import { records } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { callModel, parseJsonResponse } from '../client'
import { toPromptContext, type BusinessContext } from '../context'
import { recordObservation, upsertMemory } from '../memory'

const TOOL_NAME = 'score-record'

export type ScoreRecordInput = {
  ctx: BusinessContext
  record: {
    id: string
    recordType: string
    title: string
    currentStage: string
    valueCents: number
    daysInCurrentStage: number
    daysSinceCreated: number
    /** Last few activities on this record, newest first. */
    recentActivity?: Array<{ activityType: string; body?: string | null; ageDays: number }>
  }
}

export type ScoreRecordOutput = {
  closeProbability: number // 0..100
  churnRisk: number // 0..100
  rationale: string
  topBlocker: string | null
  recommendedNextAction: string | null
  confidence: number
}

const SYSTEM_PROMPT = `You are a sales operations analyst. Given an open record in a CRM pipeline,
estimate two numbers and a brief rationale.

CLOSE PROBABILITY (0..100): the chance this record reaches the terminal "win"
stage in the next 30 days. Use the stage position, time in stage, value
relative to baseline, and recent activity. Stale records with no movement
score lower regardless of stage.

CHURN RISK (0..100): the chance this record dies (cancellation, ghosting,
loss) in the next 30 days. High when there's been no recent activity AND the
record is past the typical decision window for its stage.

ALSO identify:
  * topBlocker — single biggest reason this might not close, or null if you
    can't tell from the data.
  * recommendedNextAction — one concrete next step the human should take.

Return ONLY this JSON:
{
  "closeProbability": 0-100,
  "churnRisk": 0-100,
  "rationale": "2-3 sentences",
  "topBlocker": "..." | null,
  "recommendedNextAction": "..." | null,
  "confidence": 0-100
}`

export async function scoreRecord(
  input: ScoreRecordInput,
): Promise<{ ok: true; output: ScoreRecordOutput } | { ok: false; reason: string }> {
  const activitySummary =
    (input.record.recentActivity ?? [])
      .slice(0, 6)
      .map((a) => `  • ${a.ageDays}d ago — ${a.activityType}${a.body ? `: ${a.body.slice(0, 120)}` : ''}`)
      .join('\n') || '  • no recorded activity'

  const userPrompt = [
    toPromptContext(input.ctx),
    '',
    `Record: ${input.record.title}`,
    `Type: ${input.record.recordType}`,
    `Current stage: ${input.record.currentStage}`,
    `Value: $${(input.record.valueCents / 100).toFixed(2)}`,
    `Days in current stage: ${input.record.daysInCurrentStage}`,
    `Days since created: ${input.record.daysSinceCreated}`,
    'Recent activity:',
    activitySummary,
    '',
    'Score it now.',
  ].join('\n')

  const result = await callModel({
    accountId: input.ctx.accountId,
    toolName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 512,
    metadata: { recordId: input.record.id, recordType: input.record.recordType },
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  const parsed = parseJsonResponse<ScoreRecordOutput>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const close = typeof r.closeProbability === 'number' ? r.closeProbability : null
    const churn = typeof r.churnRisk === 'number' ? r.churnRisk : null
    if (close === null || churn === null) return null
    return {
      closeProbability: clamp(close),
      churnRisk: clamp(churn),
      rationale: typeof r.rationale === 'string' ? r.rationale : '',
      topBlocker: typeof r.topBlocker === 'string' ? r.topBlocker : null,
      recommendedNextAction:
        typeof r.recommendedNextAction === 'string' ? r.recommendedNextAction : null,
      confidence: typeof r.confidence === 'number' ? r.confidence : 50,
    }
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  // Persist score onto the record + record-level memory so other tools see it.
  try {
    await db
      .update(records)
      .set({ closeProbability: parsed.closeProbability, updatedAt: new Date() })
      .where(eq(records.id, input.record.id))
  } catch {
    // record may have been deleted; non-fatal.
  }

  await upsertMemory({
    accountId: input.ctx.accountId,
    kind: 'record_memory',
    subjectType: 'record',
    subjectId: input.record.id,
    summary: parsed.rationale,
    evidence: {
      closeProbability: parsed.closeProbability,
      churnRisk: parsed.churnRisk,
      topBlocker: parsed.topBlocker,
      recommendedNextAction: parsed.recommendedNextAction,
      scoredAtStage: input.record.currentStage,
    },
    confidence: parsed.confidence,
    modelUsed: result.model,
  })

  await recordObservation({
    accountId: input.ctx.accountId,
    kind: 'prediction_made',
    payload: {
      tool: TOOL_NAME,
      closeProbability: parsed.closeProbability,
      churnRisk: parsed.churnRisk,
      stage: input.record.currentStage,
    },
    relatedRecordId: input.record.id,
  })

  return { ok: true, output: parsed }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.max(0, Math.min(100, Math.round(value)))
}
