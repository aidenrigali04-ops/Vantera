import { assembleAgentPrompt } from '@/lib/agents/prompt-loader'
import { callModel, parseJsonResponse } from '@/lib/ai/client'
import { hasAnthropicConfigured } from '@/lib/ai/drafting-enabled'
import { recordObservation } from '@/lib/ai/memory'
import { db } from '@/lib/db/client'
import type { OutreachCampaignGoal } from '@/lib/outreach/types'
import { CAMPAIGN_GOAL_INTENTS } from '@/lib/outreach/types'
import { hasMergeTokens, type LeadRow } from '@/lib/outreach/types'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

const TOOL_NAME = 'draft-campaign-step'

export type DraftCampaignStepOutput = {
  subject?: string
  body: string
  rationale: string
}

type Channel = 'email' | 'sms' | 'linkedin'

function taskForChannel(channel: Channel): string {
  const shared = `
Apply expert B2B sales outreach craft:
- ICP psychology: mirror the prospect's role pressures, buying committee reality, and risk of doing nothing
- Personality: infer likely DISC style from title/seniority (D=direct ROI, I=vision/social proof, S=trust/safety, C=data/logic) and match tone
- Personalization: reference company, title, and any ICP signals — never generic "reaching out"
- Marketing: one sharp value prop, one proof point, one low-friction CTA (not feature lists)
- Voice: write as the sender's business (from Platform profile), never as "Vantera" unless that is the seller
- Banned openers: "I hope this finds you well", "reaching out", "touching base", "quick question", "synergy"
`

  if (channel === 'email') {
    return `${shared}
Draft ONE cold outbound EMAIL.

Rules:
- Subject ≤ 80 chars — specific, peer-level (not clickbait)
- Body ≤ 150 words, short paragraphs, one CTA
- This copy is a reusable campaign template for many leads — NEVER use a specific person's name in the prose
- Personalization MUST use merge tags only: {{first_name}}, {{last_name}}, {{company}}, {{title}}, {{email}}
- Do not invent or hardcode recipient names from the sample prospect in the body or subject

Return ONLY JSON:
{
  "subject": "...",
  "body": "...",
  "rationale": "one sentence on ICP angle and tone choice"
}`
  }

  if (channel === 'sms') {
    return `${shared}
Draft ONE cold SMS.

Rules:
- ≤ 140 characters before opt-out line
- Curiosity hook only — no full pitch
- Must end with: Reply STOP to opt out
- Use {{first_name}} for the recipient (never a hardcoded name)

Return ONLY JSON:
{
  "body": "...",
  "rationale": "one sentence on hook and tone"
}`
  }

  return `${shared}
Draft ONE LinkedIn connection note (no pitch in the note).

Rules:
- ≤ 300 characters
- Reference something specific about their company or role
- Warm peer tone, no "I'd love to pick your brain"

Return ONLY JSON:
{
  "body": "...",
  "rationale": "one sentence on personalization angle"
}`
}

export async function draftCampaignStepMessage(input: {
  accountId: string
  lead: Pick<LeadRow, 'id' | 'firstName' | 'lastName' | 'company' | 'title' | 'email' | 'score' | 'enrichment'>
  channel: Channel
  intent: string
  goal: OutreachCampaignGoal
  stepIndex: number
}): Promise<{ ok: true; output: DraftCampaignStepOutput } | { ok: false; reason: string }> {
  if (!hasAnthropicConfigured()) {
    return {
      ok: false,
      reason: 'no_api_key',
    }
  }

  const [account] = await db
    .select({
      name: accounts.name,
      vertical: accounts.vertical,
      icpDescription: accounts.icpDescription,
      valueProposition: accounts.valueProposition,
      icpSummary: accounts.icpSummary,
    })
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1)

  const enrichment = (input.lead.enrichment ?? {}) as Record<string, unknown>
  const icpSignals = Array.isArray(enrichment.icpSignals)
    ? enrichment.icpSignals.filter((s): s is string => typeof s === 'string').slice(0, 6)
    : []

  const leadName =
    [input.lead.firstName, input.lead.lastName].filter(Boolean).join(' ') || 'Prospect'

  const callContext = [
    `Campaign goal: ${CAMPAIGN_GOAL_INTENTS[input.goal]}`,
    `Step ${input.stepIndex + 1} · Channel: ${input.channel}`,
    `Step intent: ${input.intent}`,
    '',
    `Prospect: ${leadName}`,
    input.lead.title ? `Title: ${input.lead.title}` : null,
    `Company: ${input.lead.company}`,
    input.lead.email ? `Email: ${input.lead.email}` : null,
    typeof input.lead.score === 'number' ? `Lead score: ${input.lead.score}` : null,
    icpSignals.length ? `ICP signals: ${icpSignals.join(', ')}` : null,
    account?.icpSummary ? `ICP summary: ${account.icpSummary}` : null,
    account?.icpDescription ? `Ideal customer: ${account.icpDescription}` : null,
    account?.valueProposition ? `Value proposition: ${account.valueProposition}` : null,
    account?.vertical ? `Seller vertical: ${account.vertical}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const { system, user } = await assembleAgentPrompt({
    accountId: input.accountId,
    agentId: 'message_drafter',
    taskInstructions: taskForChannel(input.channel),
    callContext,
  })

  const result = await callModel({
    accountId: input.accountId,
    toolName: TOOL_NAME,
    system,
    user,
    maxTokens: input.channel === 'email' ? 900 : 400,
    timeoutMs: 45_000,
    metadata: { channel: input.channel, leadId: input.lead.id, stepIndex: input.stepIndex },
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  const parsed = parseJsonResponse<DraftCampaignStepOutput>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.body !== 'string' || r.body.length === 0) return null
    if (input.channel === 'email' && typeof r.subject !== 'string') return null
    return {
      subject: input.channel === 'email' ? (r.subject as string) : undefined,
      body: r.body,
      rationale: typeof r.rationale === 'string' ? r.rationale : '',
    }
  })

  if (!parsed) {
    return { ok: false, reason: 'parse_error' }
  }

  const normalized = normalizeCampaignTemplateCopy(parsed, input.lead, input.channel)

  await recordObservation({
    accountId: input.accountId,
    kind: 'message_drafted',
    payload: {
      tool: TOOL_NAME,
      channel: input.channel,
      leadId: input.lead.id,
      stepIndex: input.stepIndex,
      rationale: normalized.rationale,
    },
  })

  return { ok: true, output: normalized }
}

/** If the model used the sample lead's name, swap it for merge tags for multi-recipient templates. */
function normalizeCampaignTemplateCopy(
  draft: DraftCampaignStepOutput,
  lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company' | 'title' | 'email'>,
  channel: Channel,
): DraftCampaignStepOutput {
  return {
    ...draft,
    body: scrubSampleLeadTokens(draft.body, lead),
    subject:
      channel === 'email' && draft.subject ? scrubSampleLeadTokens(draft.subject, lead) : draft.subject,
  }
}

function scrubSampleLeadTokens(
  copy: string,
  lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company' | 'title' | 'email'>,
): string {
  if (hasMergeTokens(copy)) return copy

  let result = copy
  const first = lead.firstName?.trim()
  const last = lead.lastName?.trim()
  const company = lead.company?.trim()

  if (first) result = replaceWholeWord(result, first, '{{first_name}}')
  if (last) result = replaceWholeWord(result, last, '{{last_name}}')
  if (company) result = replaceWholeWord(result, company, '{{company}}')

  return result
}

function replaceWholeWord(text: string, word: string, token: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), token)
}
