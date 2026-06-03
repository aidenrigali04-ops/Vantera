import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export type OutreachDomainStatus = 'not_configured' | 'pending' | 'verified' | 'failed'

export type AccountEmailDomainConfig = {
  accountId: string
  accountName: string
  fromAddress: string
  replyDomain: string
  fromLocalPart: string
  fromDomain: string
  isCustomDomain: boolean
  domainStatus: OutreachDomainStatus
  resendDomainId: string | null
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

function platformFromDomain(): string {
  const domain = normalizeDomain(env.NEXT_PUBLIC_APP_DOMAIN)
  if (domain && isValidOutreachDomain(domain)) return domain
  return 'vantera.app'
}

function platformInboundDomain(): string {
  const configured = env.OUTREACH_INBOUND_DOMAIN?.trim()
  if (configured) {
    const normalized = normalizeDomain(configured)
    if (normalized && isValidOutreachDomain(normalized)) return normalized
  }
  return `inbound.${platformFromDomain()}`
}

function resolveReplyDomain(fromDomain: string, inboundDomain: string | null | undefined): string {
  if (inboundDomain) {
    const normalized = normalizeDomain(inboundDomain)
    if (normalized && isValidOutreachDomain(normalized)) return normalized
  }
  return `inbound.${fromDomain}`
}

export function buildFromAddress(
  accountName: string,
  localPart: string,
  domain: string,
): string {
  const safeLocal = localPart.trim() || 'outreach'
  return `${accountName} <${safeLocal}@${domain}>`
}

export async function getAccountEmailDomainConfig(
  accountId: string,
): Promise<AccountEmailDomainConfig | null> {
  const [account] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      outreachFromDomain: accounts.outreachFromDomain,
      outreachInboundDomain: accounts.outreachInboundDomain,
      outreachFromLocalPart: accounts.outreachFromLocalPart,
      outreachDomainStatus: accounts.outreachDomainStatus,
      resendOutreachDomainId: accounts.resendOutreachDomainId,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account) return null

  const status = (account.outreachDomainStatus ?? 'not_configured') as OutreachDomainStatus
  const customFrom =
    account.outreachFromDomain &&
    status === 'verified' &&
    normalizeDomain(account.outreachFromDomain)

  const fromDomain = customFrom || platformFromDomain()
  const fromLocalPart = account.outreachFromLocalPart?.trim() || 'outreach'

  let replyDomain = platformInboundDomain()
  if (customFrom) {
    replyDomain = resolveReplyDomain(customFrom, account.outreachInboundDomain)
  }

  return {
    accountId: account.id,
    accountName: account.name,
    fromAddress: buildFromAddress(account.name, fromLocalPart, fromDomain),
    replyDomain,
    fromLocalPart,
    fromDomain,
    isCustomDomain: Boolean(customFrom),
    domainStatus: status,
    resendDomainId: account.resendOutreachDomainId,
  }
}

/** Resolved sender for outbound email — uses verified custom domain when available. */
export async function resolveOutreachSendIdentity(accountId: string): Promise<{
  from: string
  replyDomain: string
  usesVerifiedCustomDomain: boolean
}> {
  const config = await getAccountEmailDomainConfig(accountId)
  if (!config) {
    return {
      from: `Vantera <outreach@${platformFromDomain()}>`,
      replyDomain: platformInboundDomain(),
      usesVerifiedCustomDomain: false,
    }
  }

  return {
    from: config.fromAddress,
    replyDomain: config.replyDomain,
    usesVerifiedCustomDomain: config.isCustomDomain && config.domainStatus === 'verified',
  }
}

export function isValidOutreachDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  if (!normalized || normalized.includes('@')) return false
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    normalized,
  )
}

export function isValidEmailLocalPart(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 64) return false
  return /^[a-zA-Z0-9]([a-zA-Z0-9._+-]*[a-zA-Z0-9])?$/.test(trimmed)
}

/** Preview / settings — shows configured domain even before DNS verification. */
export function buildConfiguredFromAddress(input: {
  accountName: string
  fromLocalPart: string | null | undefined
  fromDomain: string | null | undefined
}): string {
  const localPart = input.fromLocalPart?.trim() || 'outreach'
  const domain = input.fromDomain ? normalizeDomain(input.fromDomain) : platformFromDomain()
  return buildFromAddress(input.accountName, localPart, domain)
}

export function buildConfiguredReplyDomain(input: {
  fromDomain: string | null | undefined
  inboundDomain: string | null | undefined
}): string {
  if (input.fromDomain) {
    const fromDomain = normalizeDomain(input.fromDomain)
    if (fromDomain && isValidOutreachDomain(fromDomain)) {
      return resolveReplyDomain(fromDomain, input.inboundDomain)
    }
  }
  return platformInboundDomain()
}

export { normalizeDomain }
