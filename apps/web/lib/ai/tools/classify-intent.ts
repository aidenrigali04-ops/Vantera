// Tool: classify-message-intent.
//
// Triages an inbound message (SMS, email, portal note) into a small set of
// Sales-intelligence actionable intents. Used by the inbound message workflow to decide
// what to do next: auto-reply, escalate to owner, schedule a callback, log
// as a complaint, etc.
//
// Output is deterministic-shaped: one primary intent, an urgency rating,
// recommended next action, and a short justification. The recommendation is
// always a suggestion — the workflow decides whether to act on it (or just
// surface it to the human).

import { callModel, parseJsonResponse } from '../client'

export type AgentContext = {
  accountId: string
  promptContext: string
}

const TOOL_NAME = 'classify-message-intent'

export const INTENT_VALUES = [
  'new_lead',
  'scheduling',
  'pricing_question',
  'status_check',
  'complaint',
  'cancellation',
  'payment',
  'compliment',
  'spam',
  'other',
] as const

export type Intent = (typeof INTENT_VALUES)[number]

export type Urgency = 'low' | 'normal' | 'high' | 'urgent'

export type RecommendedAction =
  | 'auto_reply'
  | 'draft_reply_for_human'
  | 'escalate_to_owner'
  | 'create_record'
  | 'schedule_callback'
  | 'log_only'

export type ClassifyIntentInput = {
  ctx: AgentContext
  message: {
    body: string
    channel: 'sms' | 'email' | 'portal'
    contactFirstName?: string | null
    contactKnown: boolean
  }
}

export type ClassifyIntentOutput = {
  intent: Intent
  urgency: Urgency
  recommendedAction: RecommendedAction
  rationale: string
  confidence: number
}

const SYSTEM_PROMPT = `You triage inbound customer messages for a small services business.

Pick exactly one INTENT from this list:
  new_lead, scheduling, pricing_question, status_check, complaint,
  cancellation, payment, compliment, spam, other.

Pick exactly one URGENCY: low, normal, high, urgent.
  * urgent = emergency keywords, threats to leave, time-critical scheduling
  * high   = unresolved complaints, payment issues, hot leads asking for a quote
  * normal = standard scheduling, FAQs
  * low    = compliments, FYI

Pick exactly one RECOMMENDED ACTION:
  * auto_reply              — safe to send an automated acknowledgement
  * draft_reply_for_human   — model can draft, human must review/send
  * escalate_to_owner       — owner should see this directly
  * create_record           — convert to a new pipeline record
  * schedule_callback       — owner should call back personally
  * log_only                — no response needed

Return ONLY this JSON:
{
  "intent": "...",
  "urgency": "...",
  "recommendedAction": "...",
  "rationale": "one short sentence",
  "confidence": 0-100
}`

export async function classifyMessageIntent(
  input: ClassifyIntentInput,
): Promise<{ ok: true; output: ClassifyIntentOutput } | { ok: false; reason: string }> {
  const userPrompt = [
    input.ctx.promptContext,
    '',
    `Inbound channel: ${input.message.channel}`,
    `From: ${input.message.contactKnown ? `existing contact (${input.message.contactFirstName ?? 'unknown name'})` : 'NEW / unknown contact'}`,
    'Message:',
    input.message.body,
    '',
    'Classify it now.',
  ].join('\n')

  const result = await callModel({
    accountId: input.ctx.accountId,
    toolName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 512,
    metadata: { channel: input.message.channel, contactKnown: input.message.contactKnown },
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  const parsed = parseJsonResponse<ClassifyIntentOutput>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const intent = typeof r.intent === 'string' ? r.intent : null
    const urgency = typeof r.urgency === 'string' ? r.urgency : null
    const action = typeof r.recommendedAction === 'string' ? r.recommendedAction : null
    if (!intent || !INTENT_VALUES.includes(intent as Intent)) return null
    if (!urgency || !['low', 'normal', 'high', 'urgent'].includes(urgency)) return null
    if (
      !action ||
      ![
        'auto_reply',
        'draft_reply_for_human',
        'escalate_to_owner',
        'create_record',
        'schedule_callback',
        'log_only',
      ].includes(action)
    ) {
      return null
    }
    return {
      intent: intent as Intent,
      urgency: urgency as Urgency,
      recommendedAction: action as RecommendedAction,
      rationale: typeof r.rationale === 'string' ? r.rationale : '',
      confidence: typeof r.confidence === 'number' ? r.confidence : 50,
    }
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  return { ok: true, output: parsed }
}
