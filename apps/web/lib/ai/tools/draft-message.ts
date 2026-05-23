// Tool: draft-message.
//
// Drafts a contact-bound message in the business's voice, grounded in the
// live BusinessContext + any persisted contact memory + the requested intent
// (e.g. "schedule a follow-up", "ask for a review", "explain a delay").
// The output is an outbound message draft on a chosen channel.
//
// The draft is recorded as `message_drafted` in `ai_observations`, so we
// can later correlate which drafts shipped, which got responses, and what
// language patterns work.

import { callModel, parseJsonResponse } from '../client'
import { toPromptContext, type BusinessContext } from '../context'
import { recordObservation } from '../memory'

const TOOL_NAME = 'draft-message'

export type DraftMessageInput = {
  ctx: BusinessContext
  contact: {
    id: string
    firstName: string
    lastName?: string | null
    /** Recent messaging history with this contact, oldest → newest. */
    recentHistory?: Array<{ direction: 'inbound' | 'outbound'; body: string }>
    /** Optional persisted contact memory summary. */
    memorySummary?: string
  }
  intent: string
  channel: 'sms' | 'email' | 'portal'
}

export type DraftMessageOutput = {
  channel: 'sms' | 'email' | 'portal'
  subject?: string
  body: string
  rationale: string
}

const SYSTEM_PROMPT = `You are the writing voice of a small services business. Draft ONE outbound
message to a customer using the business's tone of voice and live context.

Rules:
  * Match the requested CHANNEL: SMS = under 320 characters, no subject, no
    pleasantry boilerplate. Email = include a short subject (≤ 80 chars).
    Portal = like SMS but slightly more formal.
  * Honor the business voice if specified (friendly / professional / urgent).
  * If recent messaging history is provided, write the NEXT logical message
    in the conversation. Don't repeat what was already said.
  * Use {{contact.first_name}} for the recipient's name unless they have
    already been addressed by name in the history (then use their name
    literally — placeholders go stale).
  * Include exactly ONE clear next step: a question, a link, or a confirmation
    request. No more, no less.
  * Never invent facts. If you don't know a price / time / address, write a
    {{placeholder}} for it.

Return ONLY this JSON:
{
  "channel": "sms" | "email" | "portal",
  "subject": "..." | null,
  "body": "...",
  "rationale": "one short sentence on why you wrote it this way"
}`

export async function draftMessage(
  input: DraftMessageInput,
): Promise<{ ok: true; output: DraftMessageOutput } | { ok: false; reason: string }> {
  const history = (input.contact.recentHistory ?? [])
    .slice(-6)
    .map((m, i) => `  ${i + 1}. [${m.direction}] ${m.body}`)
    .join('\n')

  const userPrompt = [
    toPromptContext(input.ctx),
    '',
    `Recipient: ${input.contact.firstName}${input.contact.lastName ? ` ${input.contact.lastName}` : ''}`,
    input.contact.memorySummary ? `What we know about them: ${input.contact.memorySummary}` : null,
    history ? `Recent thread:\n${history}` : 'No prior thread.',
    '',
    `Channel: ${input.channel}`,
    `Intent: ${input.intent}`,
    '',
    'Draft the message now.',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n')

  const result = await callModel({
    accountId: input.ctx.accountId,
    toolName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 768,
    metadata: { channel: input.channel, contactId: input.contact.id },
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  const parsed = parseJsonResponse<DraftMessageOutput>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.body !== 'string' || r.body.length === 0) return null
    const channel = typeof r.channel === 'string' ? r.channel : input.channel
    if (channel !== 'sms' && channel !== 'email' && channel !== 'portal') return null
    return {
      channel,
      subject: typeof r.subject === 'string' && r.subject.length > 0 ? r.subject : undefined,
      body: r.body,
      rationale: typeof r.rationale === 'string' ? r.rationale : '',
    }
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  await recordObservation({
    accountId: input.ctx.accountId,
    kind: 'message_drafted',
    payload: {
      tool: TOOL_NAME,
      channel: parsed.channel,
      bodyPreview: parsed.body.slice(0, 200),
      rationale: parsed.rationale,
      intent: input.intent,
    },
    relatedContactId: input.contact.id,
  })

  return { ok: true, output: parsed }
}
