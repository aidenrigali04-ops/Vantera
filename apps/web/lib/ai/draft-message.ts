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

const EMAIL_SYSTEM = `You are a B2B sales copywriter for a service business. Draft ONE cold outbound email.

Rules:
- Use the business display name provided — never say "Vantera"
- Reference ICP signals naturally (not as a bullet list)
- Match vertical-specific pain points
- Under 120 words
- Subject: pattern-interrupt (not "Quick question" or "Following up")
- Body: 1 specific pain ref → 1 outcome sentence → soft CTA
- No "I hope this finds you well", generic openers, or passive voice

Return ONLY JSON:
{
  "subject": "...",
  "body": "...",
  "triggers": ["curiosity", "social proof"]
}`

const SMS_SYSTEM = `You are a B2B sales copywriter. Draft ONE cold SMS.

Rules:
- Under 140 characters
- Curiosity hook — no pitch in first message
- Must end with: Reply STOP to opt out
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
      const result = await callModel({
        accountId: context.accountId,
        toolName: 'draft-outreach-email',
        system: EMAIL_SYSTEM,
        user: sharedContext,
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
      const result = await callModel({
        accountId: context.accountId,
        toolName: 'draft-outreach-sms',
        system: SMS_SYSTEM,
        user: sharedContext,
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
  _accountId: string,
  _segmentKey: string,
  _draftId: string,
  _outcome: 'interested' | 'objection' | 'no_response',
): Promise<void> {
  // Phase 2 stub — wire to agent_memory when embeddings pipeline is ready
}
