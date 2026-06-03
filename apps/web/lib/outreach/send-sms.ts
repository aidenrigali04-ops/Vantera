import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { resolveOutboundCopy } from '@/lib/outreach/types'
import type { LeadRow } from '@/lib/outreach/types'
import { decryptCredentialValue } from '@/lib/integrations/credential-secrets'
import { integrationCredentials } from '@vantera/db'
import { eq } from 'drizzle-orm'
import twilio from 'twilio'

export type SendCampaignSmsInput = {
  accountId: string
  toPhone: string
  body: string
  lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company' | 'email' | 'title'>
}

export type SendCampaignSmsResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string }

async function loadTwilioConfig(accountId: string) {
  const platformSid = env.TWILIO_ACCOUNT_SID
  const platformToken = env.TWILIO_AUTH_TOKEN
  const platformFrom = env.TWILIO_PHONE_NUMBER

  if (platformSid && platformToken && platformFrom) {
    return { sid: platformSid, token: platformToken, from: platformFrom }
  }

  const [row] = await db
    .select({
      accessToken: integrationCredentials.accessToken,
      metadata: integrationCredentials.metadata,
    })
    .from(integrationCredentials)
    .where(eq(integrationCredentials.accountId, accountId))
    .limit(1)

  if (!row?.accessToken) return null

  const metadata = row.metadata as Record<string, string> | null
  const phoneNumber = metadata?.phoneNumber ?? platformFrom
  if (!phoneNumber) return null

  const token = decryptCredentialValue(row.accessToken)
  if (!token) return null

  return {
    sid: metadata?.accountSid ?? platformSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
    token,
    from: phoneNumber,
  }
}

export async function sendCampaignSms(input: SendCampaignSmsInput): Promise<SendCampaignSmsResult> {
  if (!input.toPhone?.trim()) {
    return { ok: false, reason: 'missing_recipient_phone' }
  }

  const config = await loadTwilioConfig(input.accountId)
  if (!config?.sid || !config.token || !config.from) {
    return { ok: false, reason: 'twilio_not_configured' }
  }

  const text = resolveOutboundCopy(input.body, input.lead)

  try {
    const client = twilio(config.sid, config.token)
    const message = await client.messages.create({
      to: input.toPhone,
      from: config.from,
      body: text,
    })

    return { ok: true, providerMessageId: message.sid }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'sms_send_failed',
    }
  }
}
