import { env } from '@/lib/env'

const STEP_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Platform fallback when account has no verified custom inbound domain. */
export function getPlatformInboundDomain(): string {
  const configured = env.OUTREACH_INBOUND_DOMAIN?.trim()
  if (configured) return configured.toLowerCase()
  return `inbound.${env.NEXT_PUBLIC_APP_DOMAIN}`
}

/** Plus-address encodes the campaign step id for deterministic reply routing. */
export function buildCampaignReplyAddress(stepId: string, inboundDomain?: string): string {
  const domain = (inboundDomain?.trim() || getPlatformInboundDomain()).toLowerCase()
  return `replies+${stepId}@${domain}`
}

export function parseStepIdFromReplyAddress(address: string): string | null {
  const localPart = address.split('@')[0]?.toLowerCase() ?? ''
  const match = localPart.match(/^replies\+(.+)$/)
  if (!match?.[1]) return null
  const stepId = match[1]
  return STEP_ID_PATTERN.test(stepId) ? stepId : null
}

export function parseStepIdFromAddresses(addresses: string[]): string | null {
  for (const address of addresses) {
    const stepId = parseStepIdFromReplyAddress(address)
    if (stepId) return stepId
  }
  return null
}
