import { assembleAgentPrompt } from '@/lib/agents/prompt-loader'
import { callModel, parseJsonResponse } from '@/lib/ai/client'
import type { DraftResult } from '@/lib/aspire/types'

export interface DraftContext {
  accountId: string
  accountDisplayName: string
  accountVertical: string
  firstName: string
  lastName: string
  title: string
  company: string
  industry: string
  email: string | null
  phone: string | null
  employeeCount: number | null
  technologies: string[]
  icpScore: number
  icpSignals: string[]
  memoryContext?: string
}

const EMAIL_SYSTEM = `You are an expert B2B sales copywriter. Draft ONE cold outbound email.

Craft:
- ICP psychology: role pressure, cost of inaction, and why now
- Personality: infer DISC from title (D=direct ROI, I=vision, S=trust, C=data) and match tone
- Personalization: weave ICP signals and company specifics into sentence one
- Marketing: one outcome-led value prop, one proof point, one low-friction CTA

Rules:
- Use the business display name provided — never say "Vantera" unless that is the seller
- Under 120 words; subject ≤ 80 chars (pattern-interrupt, not "Quick question")
- No "I hope this finds you well", "reaching out", or passive voice
- This email is for ONE named prospect in context — use their real first name and company; do NOT use {{first_name}} merge tags

Return ONLY JSON:
{
  "subject": "...",
  "body": "...",
  "triggers": ["curiosity", "social proof"]
}`

const SMS_SYSTEM = `You are an expert B2B sales copywriter. Draft ONE cold SMS.

Craft: curiosity hook tuned to ICP psychology — no pitch in the first touch.

Rules:
- Under 140 characters before "Reply STOP to opt out"
- Use business name naturally

Return ONLY JSON:
{
  "body": "...",
  "triggers": ["curiosity"]
}`

function segmentKey(vertical: string, employeeCount: number | null): string {
  const size =
    employeeCount == null ? 'unknown' : employeeCount <= 10 ? 'small' : employeeCount <= 50 ? 'mid' : 'large'
  return `${vertical}_${size}`
}

export async function draftOutreachMessages(context: DraftContext): Promise<DraftResult[]> {
  const drafts: DraftResult[] = []
  const segment = segmentKey(context.accountVertical, context.employeeCount)
  const signalText = context.icpSignals.slice(0, 4).join(', ')

  const sharedContext = [
    `Business: ${context.accountDisplayName}`,
    `Vertical: ${context.accountVertical}`,
    `Prospect: ${context.firstName} ${context.lastName}, ${context.title} at ${context.company}`,
    context.industry ? `Industry: ${context.industry}` : null,
    context.employeeCount ? `Employees: ${context.employeeCount}` : null,
    `ICP score: ${context.icpScore}`,
    signalText ? `ICP signals: ${signalText}` : null,
    context.memoryContext ? `Past performance: ${context.memoryContext}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (context.email) {
    try {
      const emailPrompt = await assembleAgentPrompt({
        accountId: context.accountId,
        agentId: 'message_drafter',
        taskInstructions: EMAIL_SYSTEM,
        callContext: sharedContext,
      })

      const result = await callModel({
        accountId: context.accountId,
        toolName: 'draft-outreach-email',
        system: emailPrompt.system,
        user: emailPrompt.user,
        maxTokens: 500,
        timeoutMs: 30_000,
      })

      if (result.ok) {
        const parsed = parseJsonResponse<{ subject: string; body: string; triggers?: string[] }>(
          result.text,
          (raw) => {
            if (!raw || typeof raw !== 'object') return null
            const r = raw as Record<string, unknown>
            if (typeof r.body !== 'string' || typeof r.subject !== 'string') return null
            return {
              subject: r.subject,
              body: r.body,
              triggers: Array.isArray(r.triggers)
                ? r.triggers.filter((t): t is string => typeof t === 'string')
                : [],
            }
          },
        )

        if (parsed) {
          drafts.push({
            channel: 'email',
            subject: parsed.subject,
            body: parsed.body,
            metadata: {
              segmentKey: segment,
              icpScore: context.icpScore,
              triggers: parsed.triggers ?? [],
            },
          })
        }
      }
    } catch (error) {
      console.error('[draftOutreachMessages] email draft failed:', error)
    }
  }

  if (context.phone) {
    try {
      const smsPrompt = await assembleAgentPrompt({
        accountId: context.accountId,
        agentId: 'message_drafter',
        taskInstructions: SMS_SYSTEM,
        callContext: sharedContext,
      })

      const result = await callModel({
        accountId: context.accountId,
        toolName: 'draft-outreach-sms',
        system: smsPrompt.system,
        user: smsPrompt.user,
        maxTokens: 120,
        timeoutMs: 30_000,
      })

      if (result.ok) {
        const parsed = parseJsonResponse<{ body: string; triggers?: string[] }>(result.text, (raw) => {
          if (!raw || typeof raw !== 'object') return null
          const r = raw as Record<string, unknown>
          if (typeof r.body !== 'string') return null
          return {
            body: r.body,
            triggers: Array.isArray(r.triggers)
              ? r.triggers.filter((t): t is string => typeof t === 'string')
              : [],
          }
        })

        if (parsed) {
          drafts.push({
            channel: 'sms',
            body: parsed.body,
            metadata: {
              segmentKey: segment,
              icpScore: context.icpScore,
              triggers: parsed.triggers ?? [],
            },
          })
        }
      }
    } catch (error) {
      console.error('[draftOutreachMessages] sms draft failed:', error)
    }
  }

  return drafts
}

export async function reinforceMessageMemory(
  accountId: string,
  segmentKey: string,
  _draftId: string,
  outcome: 'interested' | 'objection' | 'no_response',
): Promise<void> {
  const { reinforceSdrSegmentMemory } = await import('@/lib/sdr/memory')
  const [vertical, size] = segmentKey.split('_')
  const employeeCount =
    size === 'small' ? 5 : size === 'mid' ? 30 : size === 'large' ? 100 : null

  await reinforceSdrSegmentMemory({
    accountId,
    vertical: vertical ?? 'agency',
    employeeCount,
    stepNumber: 1,
    channel: 'email',
    openingHook: segmentKey,
    outcome: outcome === 'no_response' ? 'objection' : outcome,
  })
}
