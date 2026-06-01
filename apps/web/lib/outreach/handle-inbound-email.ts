import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import {
  findCampaignStepById,
  findCampaignStepByProviderMessageId,
  findRecentSentStepForLeadEmail,
} from '@/lib/outreach/queries'
import { parseStepIdFromAddresses } from '@/lib/outreach/reply-address'
import { recordCampaignInboundReply } from '@/lib/outreach/record-reply'
import { users } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export type ResendEmailReceivedEvent = {
  type: 'email.received'
  data: {
    email_id: string
    from: string
    to: string[]
    subject?: string
    message_id?: string
  }
}

type ResendReceivedEmail = {
  text?: string | null
  html?: string | null
  headers?: Record<string, unknown>
}

export type HandleInboundEmailResult =
  | { ok: true; matched: boolean; stepId?: string; campaignId?: string }
  | { ok: false; reason: string }

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match?.[1] ?? raw).trim().toLowerCase()
}

function extractMessageIdsFromHeaders(headers: Record<string, unknown> | undefined): string[] {
  if (!headers) return []
  const ids: string[] = []

  for (const key of ['in-reply-to', 'references', 'In-Reply-To', 'References']) {
    const value = headers[key]
    if (typeof value === 'string') {
      for (const token of value.match(/<[^>]+>|[^\s,]+/g) ?? []) {
        ids.push(token.replace(/^<|>$/g, ''))
      }
    }
  }

  return ids
}

async function resolveAccountOwnerId(accountId: string): Promise<string | null> {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.accountId, accountId), eq(users.role, 'owner'), eq(users.isActive, true)))
    .limit(1)

  return owner?.id ?? null
}

async function processMatchedStep(input: {
  stepId: string
  fromEmail: string
  subject?: string
  bodyPreview?: string
  inboundEmailId: string
}): Promise<HandleInboundEmailResult> {
  const step = await findCampaignStepById(input.stepId)
  if (!step) {
    return { ok: true, matched: false }
  }

  const ownerId = await resolveAccountOwnerId(step.accountId)
  if (!ownerId) {
    return { ok: false, reason: 'no_active_owner' }
  }

  const result = await recordCampaignInboundReply({
    accountId: step.accountId,
    enrollmentId: step.enrollmentId,
    campaignId: step.campaignId,
    leadId: step.leadId,
    stepId: step.id,
    fromEmail: input.fromEmail,
    subject: input.subject,
    bodyPreview: input.bodyPreview,
    inboundEmailId: input.inboundEmailId,
    actorUserId: ownerId,
  })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    matched: true,
    stepId: step.id,
    campaignId: step.campaignId,
  }
}

async function fetchReceivedEmail(emailId: string): Promise<ResendReceivedEmail | null> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) return null
    return (await response.json()) as ResendReceivedEmail
  } catch {
    return null
  }
}

export async function handleResendInboundEmail(
  event: ResendEmailReceivedEvent,
): Promise<HandleInboundEmailResult> {
  const fromEmail = extractEmailAddress(event.data.from)
  const toAddresses = event.data.to.map((address) => address.toLowerCase())
  const stepIdFromAddress = parseStepIdFromAddresses(toAddresses)

  let bodyPreview: string | undefined
  let headerMessageIds: string[] = []

  const received = await fetchReceivedEmail(event.data.email_id)
  if (received) {
    bodyPreview =
      received.text?.slice(0, 500) ??
      received.html?.replace(/<[^>]+>/g, ' ').slice(0, 500)
    headerMessageIds = extractMessageIdsFromHeaders(received.headers)
  }

  if (stepIdFromAddress) {
    const campaignResult = await processMatchedStep({
      stepId: stepIdFromAddress,
      fromEmail,
      subject: event.data.subject,
      bodyPreview,
      inboundEmailId: event.data.email_id,
    })
    if (campaignResult.ok && campaignResult.matched) return campaignResult

    const { handleSdrReply } = await import('@/lib/sdr/reply-handler')
    const sdrResult = await handleSdrReply({
      stepId: stepIdFromAddress,
      bodyPreview,
      fromEmail,
    })
    if (sdrResult.handled) {
      return { ok: true, matched: true, stepId: stepIdFromAddress }
    }
  }

  for (const messageId of headerMessageIds) {
    const step = await findCampaignStepByProviderMessageId(messageId)
    if (step) {
      return processMatchedStep({
        stepId: step.id,
        fromEmail,
        subject: event.data.subject,
        bodyPreview,
        inboundEmailId: event.data.email_id,
      })
    }
  }

  if (event.data.message_id) {
    const step = await findCampaignStepByProviderMessageId(event.data.message_id)
    if (step) {
      return processMatchedStep({
        stepId: step.id,
        fromEmail,
        subject: event.data.subject,
        bodyPreview,
        inboundEmailId: event.data.email_id,
      })
    }
  }

  const fallbackStep = await findRecentSentStepForLeadEmail(fromEmail)
  if (fallbackStep) {
    return processMatchedStep({
      stepId: fallbackStep.id,
      fromEmail,
      subject: event.data.subject,
      bodyPreview,
      inboundEmailId: event.data.email_id,
    })
  }

  return { ok: true, matched: false }
}
