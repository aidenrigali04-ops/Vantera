import { callModel, parseJsonResponse } from '@/lib/ai/client'
import { loadBusinessContext, toPromptContext } from '@/lib/ai/context'
import { recordObservation } from '@/lib/ai/memory'
import { env } from '@/lib/env'
import type { LeadRow } from '@/lib/outreach/types'

const TOOL_NAME = 'draft-lead-message'

export type DraftLeadMessageOutput = {
  subject: string
  body: string
  rationale: string
}

const SYSTEM_PROMPT = `You are an expert B2B sales copywriter. Draft ONE cold outbound EMAIL to a prospect lead.

Rules:
  * Subject line ≤ 80 characters — specific, not clickbait.
  * Body ≤ 150 words. Short paragraphs. One clear CTA (reply or book a call).
  * Use {{first_name}} for the recipient's first name — we replace it at send time.
  * Match the business voice if specified.
  * Never invent facts about the prospect beyond what is provided.
  * No filler openers like "I hope this email finds you well".

Return ONLY JSON:
{
  "subject": "...",
  "body": "...",
  "rationale": "one short sentence"
}`

export async function draftLeadMessage(input: {
  accountId: string
  userId: string
  lead: Pick<LeadRow, 'id' | 'firstName' | 'lastName' | 'company' | 'title' | 'email'>
  intent: string
}): Promise<{ ok: true; output: DraftLeadMessageOutput } | { ok: false; reason: string }> {
  const ctx = await loadBusinessContext(
    input.accountId,
    input.userId,
    env.NEXT_PUBLIC_APP_URL,
    env.RESEND_API_KEY || null,
  )

  const leadName = [input.lead.firstName, input.lead.lastName].filter(Boolean).join(' ') || 'Prospect'

  const userPrompt = [
    toPromptContext(ctx),
    '',
    `Lead: ${leadName}`,
    input.lead.title ? `Title: ${input.lead.title}` : null,
    `Company: ${input.lead.company}`,
    input.lead.email ? `Email: ${input.lead.email}` : null,
    '',
    `Intent: ${input.intent}`,
    '',
    'Draft the email now.',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n')

  const result = await callModel({
    accountId: input.accountId,
    toolName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 768,
    metadata: { leadId: input.lead.id },
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  const parsed = parseJsonResponse<DraftLeadMessageOutput>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.body !== 'string' || typeof r.subject !== 'string') return null
    return {
      subject: r.subject,
      body: r.body,
      rationale: typeof r.rationale === 'string' ? r.rationale : '',
    }
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  await recordObservation({
    accountId: input.accountId,
    kind: 'message_drafted',
    payload: {
      tool: TOOL_NAME,
      channel: 'email',
      leadId: input.lead.id,
      subjectPreview: parsed.subject.slice(0, 80),
      bodyPreview: parsed.body.slice(0, 200),
      intent: input.intent,
    },
  })

  return { ok: true, output: parsed }
}
