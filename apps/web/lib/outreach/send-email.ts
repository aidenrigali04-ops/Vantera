import { env } from '@/lib/env'
import { resolveOutreachSendIdentity } from '@/lib/outreach/email-domain'
import { buildCampaignReplyAddress } from '@/lib/outreach/reply-address'
import { personalizeTemplate } from '@/lib/outreach/types'
import type { LeadRow } from '@/lib/outreach/types'
import { Resend } from 'resend'

export type SendCampaignEmailInput = {
  accountId: string
  accountName: string
  toEmail: string
  subject: string
  body: string
  lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company' | 'email' | 'title'>
  stepId: string
}

export type SendCampaignEmailResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string }

export async function sendCampaignEmail(
  input: SendCampaignEmailInput,
): Promise<SendCampaignEmailResult> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'resend_not_configured' }
  }

  if (!input.toEmail) {
    return { ok: false, reason: 'missing_recipient_email' }
  }

  const subject = personalizeTemplate(input.subject, input.lead)
  const text = personalizeTemplate(input.body, input.lead)

  const identity = await resolveOutreachSendIdentity(input.accountId)
  const from = identity.from || `${input.accountName} <outreach@${env.NEXT_PUBLIC_APP_DOMAIN}>`
  const replyTo = buildCampaignReplyAddress(input.stepId, identity.replyDomain)

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a;line-height:1.6;font-size:14px">
      ${text
        .split('\n')
        .map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`)
        .join('')}
    </div>
  `

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: input.toEmail,
      reply_to: replyTo,
      subject,
      html,
      text,
    })

    if (error) {
      return { ok: false, reason: error.message }
    }

    return { ok: true, providerMessageId: data?.id ?? 'unknown' }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'send_failed',
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
