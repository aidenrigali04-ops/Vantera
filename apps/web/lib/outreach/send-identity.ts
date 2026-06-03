import { env } from '@/lib/env'
import { isValidOutreachDomain, normalizeDomain } from '@/lib/outreach/email-domain'

const EMAIL_IN_FROM_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function extractEmailFromFromHeader(from: string): string | null {
  const trimmed = from.trim()
  if (!trimmed) return null

  const bracketed = trimmed.match(/<([^>]+)>/)
  const candidate = (bracketed?.[1] ?? trimmed).trim().toLowerCase()
  return EMAIL_IN_FROM_RE.test(candidate) ? candidate : null
}

export function validateOutreachSendIdentity(identity: {
  from: string
  replyDomain: string
}): string | null {
  const fromEmail = extractEmailFromFromHeader(identity.from)
  if (!fromEmail) {
    return 'Invalid sender address. Open Settings → Outreach email domain and verify your domain setup.'
  }

  const replyDomain = normalizeDomain(identity.replyDomain)
  if (!replyDomain || !isValidOutreachDomain(replyDomain)) {
    return 'Invalid reply domain for outreach. Re-save your outreach domain in Settings.'
  }

  return null
}

export type OutreachEmailSendReadiness =
  | { ready: true }
  | { ready: false; message: string }

/** Preflight before campaign or SDR email sends. */
export async function getOutreachEmailSendReadiness(
  accountId: string,
): Promise<OutreachEmailSendReadiness> {
  if (!env.RESEND_API_KEY?.trim()) {
    return { ready: false, message: 'Resend is not configured (RESEND_API_KEY).' }
  }

  const { resolveOutreachSendIdentity } = await import('@/lib/outreach/email-domain')
  const identity = await resolveOutreachSendIdentity(accountId)
  const validationError = validateOutreachSendIdentity(identity)
  if (validationError) {
    return { ready: false, message: validationError }
  }

  return { ready: true }
}
