import { env } from '@/lib/env'
import { personalizeTemplate } from '@/lib/outreach/types'
import { buildCampaignReplyAddress } from '@/lib/outreach/reply-address'
import { sendCampaignSms } from '@/lib/outreach/send-sms'
import type { SdrOutreachWindow } from '@/lib/sdr/types'
import { Resend } from 'resend'

type LeadPick = {
  firstName: string | null
  lastName: string | null
  company: string
  email: string | null
  title: string | null
  phone: string | null
}

export async function sendSdrEmail(input: {
  accountId: string
  fromEmail: string
  fromName: string
  toEmail: string
  subject: string
  body: string
  signature?: string | null
  lead: LeadPick
  stepId: string
}): Promise<{ ok: true; resendId: string } | { ok: false; reason: string }> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) return { ok: false, reason: 'resend_not_configured' }
  if (!input.toEmail) return { ok: false, reason: 'missing_recipient_email' }

  const subject = personalizeTemplate(input.subject, input.lead)
  let text = personalizeTemplate(input.body, input.lead)
  if (input.signature) {
    text = `${text}\n\n${input.signature}`
  }

  const replyTo = buildCampaignReplyAddress(input.stepId)
  const html = text
    .split('\n')
    .map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`)
    .join('')

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: input.toEmail,
      reply_to: replyTo,
      subject,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px">${html}</div>`,
      text,
    })

    if (error) return { ok: false, reason: error.message }
    return { ok: true, resendId: data?.id ?? 'unknown' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'send_failed' }
  }
}

export async function sendSdrSms(input: {
  accountId: string
  toPhone: string
  body: string
  lead: LeadPick
}): Promise<{ ok: true; twilioSid: string } | { ok: false; reason: string }> {
  const result = await sendCampaignSms({
    accountId: input.accountId,
    toPhone: input.toPhone,
    body: personalizeTemplate(input.body, input.lead),
    lead: input.lead,
  })

  if (!result.ok) return result
  return { ok: true, twilioSid: result.providerMessageId }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type { SdrOutreachWindow }
