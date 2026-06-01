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
  return env.NEXT_PUBLIC_APP_DOMAIN
}

function platformInboundDomain(): string {
  const configured = env.OUTREACH_INBOUND_DOMAIN?.trim()
  if (configured) return normalizeDomain(configured)
  return `inbound.${platformFromDomain()}`
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
    replyDomain = account.outreachInboundDomain
      ? normalizeDomain(account.outreachInboundDomain)
      : `inbound.${customFrom}`
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

export function isValidOutreachDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  if (!normalized || normalized.includes('@')) return false
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    normalized,
  )
}

export { normalizeDomain }
