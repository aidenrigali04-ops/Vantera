'use server'

import type { ActionResult } from '@/lib/auth/types'
import { ROLE_RANK } from '@/lib/auth/constants'
import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import {
  buildConfiguredFromAddress,
  buildConfiguredReplyDomain,
  getAccountEmailDomainConfig,
  isValidEmailLocalPart,
  isValidOutreachDomain,
  normalizeDomain,
} from '@/lib/outreach/email-domain'
import {
  ensureResendDomain,
  getResendDomain,
  loadResendDomainWithRecords,
  mapResendStatus,
  parseStoredDomainDns,
  partitionDnsRecords,
  verifyResendDomain,
  type ResendDnsRecord,
} from '@/lib/outreach/resend-domains'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type OutreachDomainSettings = {
  fromDomain: string | null
  inboundDomain: string | null
  fromLocalPart: string
  domainStatus: string
  inboundDomainStatus: string
  sendingRecords: ResendDnsRecord[]
  inboundRecords: ResendDnsRecord[]
  /** @deprecated use sendingRecords */
  dnsRecords: ResendDnsRecord[]
  previewFrom: string
  previewReplyDomain: string
  isCustomDomain: boolean
  /** Set when save succeeded but inbound subdomain registration failed. */
  inboundSetupWarning?: string | null
}

async function assertAdminAccess(): Promise<string> {
  const session = await getAdminSession()
  if (!session) throw new Error('Your session expired. Refresh and sign in again.')
  if ((ROLE_RANK[session.role] ?? 0) < ROLE_RANK.admin) {
    throw new Error('You do not have permission to change outreach settings.')
  }
  return session.accountId
}

async function loadAccountDomainRow(accountId: string) {
  const [account] = await db
    .select({
      name: accounts.name,
      outreachFromDomain: accounts.outreachFromDomain,
      outreachInboundDomain: accounts.outreachInboundDomain,
      outreachFromLocalPart: accounts.outreachFromLocalPart,
      outreachDomainStatus: accounts.outreachDomainStatus,
      outreachDomainDns: accounts.outreachDomainDns,
      resendOutreachDomainId: accounts.resendOutreachDomainId,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return account ?? null
}

function buildSettings(
  account: NonNullable<Awaited<ReturnType<typeof loadAccountDomainRow>>>,
  config: NonNullable<Awaited<ReturnType<typeof getAccountEmailDomainConfig>>>,
  inboundDomainStatus: string,
): OutreachDomainSettings {
  const parsed = parseStoredDomainDns(account.outreachDomainDns)
  const hasConfiguredDomain = Boolean(account.outreachFromDomain)
  return {
    fromDomain: account.outreachFromDomain ?? null,
    inboundDomain: account.outreachInboundDomain ?? null,
    fromLocalPart: account.outreachFromLocalPart ?? 'outreach',
    domainStatus: account.outreachDomainStatus ?? 'not_configured',
    inboundDomainStatus,
    sendingRecords: parsed.sendingRecords,
    inboundRecords: parsed.inboundRecords,
    dnsRecords: parsed.sendingRecords,
    previewFrom: hasConfiguredDomain
      ? buildConfiguredFromAddress({
          accountName: account.name,
          fromLocalPart: account.outreachFromLocalPart,
          fromDomain: account.outreachFromDomain,
        })
      : config.fromAddress,
    previewReplyDomain: hasConfiguredDomain
      ? buildConfiguredReplyDomain({
          fromDomain: account.outreachFromDomain,
          inboundDomain: account.outreachInboundDomain,
        })
      : config.replyDomain,
    isCustomDomain: hasConfiguredDomain,
  }
}

async function fetchInboundDomainStatus(
  resendInboundDomainId: string | null,
): Promise<string> {
  if (!resendInboundDomainId) return 'not_configured'
  try {
    const inbound = await loadResendDomainWithRecords(resendInboundDomainId)
    return mapResendStatus(inbound.status)
  } catch {
    return 'pending'
  }
}

export async function getOutreachDomainSettings(): Promise<ActionResult<OutreachDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const config = await getAccountEmailDomainConfig(accountId)
    if (!config) return { success: false, error: 'Account not found' }

    const account = await loadAccountDomainRow(accountId)
    if (!account) return { success: false, error: 'Account not found' }

    const parsed = parseStoredDomainDns(account.outreachDomainDns)
    const inboundDomainStatus = await fetchInboundDomainStatus(parsed.resendInboundDomainId)

    return {
      success: true,
      data: buildSettings(account, config, inboundDomainStatus),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not load outreach domain settings',
    }
  }
}

export async function saveOutreachDomain(input: {
  fromDomain: string
  inboundDomain?: string
  fromLocalPart?: string
}): Promise<ActionResult<OutreachDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const existing = await loadAccountDomainRow(accountId)
    const fromDomain = normalizeDomain(input.fromDomain)
    const inboundDomain = input.inboundDomain?.trim()
      ? normalizeDomain(input.inboundDomain)
      : `inbound.${fromDomain}`
    const fromLocalPart = input.fromLocalPart?.trim() || 'outreach'

    if (!isValidOutreachDomain(fromDomain)) {
      return { success: false, error: 'Enter a valid domain like acmehvac.com' }
    }

    if (!isValidOutreachDomain(inboundDomain)) {
      return { success: false, error: 'Enter a valid inbound subdomain like inbound.acmehvac.com' }
    }

    if (!isValidEmailLocalPart(fromLocalPart)) {
      return { success: false, error: 'From prefix must be a valid email local part (e.g. outreach)' }
    }

    const parsedExisting = parseStoredDomainDns(existing?.outreachDomainDns)
    const inboundUnchanged =
      existing?.outreachInboundDomain &&
      normalizeDomain(existing.outreachInboundDomain) === inboundDomain

    const sendingDomain = await ensureResendDomain(
      fromDomain,
      { sending: 'enabled', receiving: 'disabled' },
      existing?.resendOutreachDomainId,
    )

    let inboundDomainResendId: string | null = inboundUnchanged
      ? parsedExisting.resendInboundDomainId
      : null
    let inboundRecords: ResendDnsRecord[] = inboundUnchanged ? parsedExisting.inboundRecords : []
    let inboundSetupWarning: string | null = null

    if (!inboundDomainResendId) {
      try {
        const receivingDomain = await ensureResendDomain(
          inboundDomain,
          { sending: 'disabled', receiving: 'enabled' },
          null,
        )
        inboundDomainResendId = receivingDomain.id
        inboundRecords = receivingDomain.records ?? []
      } catch (error) {
        inboundSetupWarning =
          error instanceof Error
            ? error.message
            : 'Inbound reply domain could not be registered — sending DNS is still available.'
        console.warn('[saveOutreachDomain] inbound domain registration failed:', error)
      }
    } else if (inboundRecords.length === 0) {
      try {
        const receivingDomain = await loadResendDomainWithRecords(inboundDomainResendId)
        inboundRecords = receivingDomain.records ?? []
      } catch (error) {
        inboundSetupWarning =
          error instanceof Error
            ? error.message
            : 'Could not load inbound DNS records — try Refresh DNS status.'
        console.warn('[saveOutreachDomain] inbound domain reload failed:', error)
      }
    }

    let { sendingRecords } = partitionDnsRecords(sendingDomain.records ?? [])
    if (sendingRecords.length === 0 && (sendingDomain.records?.length ?? 0) > 0) {
      sendingRecords = sendingDomain.records ?? []
    }

    await db
      .update(accounts)
      .set({
        outreachFromDomain: fromDomain,
        outreachInboundDomain: inboundDomain,
        outreachFromLocalPart: fromLocalPart,
        outreachDomainStatus: mapResendStatus(sendingDomain.status),
        resendOutreachDomainId: sendingDomain.id,
        outreachDomainDns: {
          sendingRecords,
          inboundRecords,
          resendInboundDomainId: inboundDomainResendId,
        },
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    revalidatePath('/admin/settings')

    const refreshed = await getOutreachDomainSettings()
    if (!refreshed.success) {
      return { success: false, error: refreshed.error ?? 'Domain saved but settings could not be reloaded' }
    }
    if (!refreshed.data) {
      return { success: false, error: 'Domain saved but settings could not be reloaded' }
    }

    return {
      success: true,
      data: {
        ...refreshed.data,
        inboundSetupWarning,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not save outreach domain',
    }
  }
}

export async function refreshOutreachDomainDns(): Promise<ActionResult<OutreachDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const account = await loadAccountDomainRow(accountId)
    if (!account?.resendOutreachDomainId) {
      return { success: false, error: 'Save your domain first' }
    }

    const parsed = parseStoredDomainDns(account.outreachDomainDns)
    const sendingLatest = await loadResendDomainWithRecords(account.resendOutreachDomainId)
    let { sendingRecords } = partitionDnsRecords(sendingLatest.records ?? [])
    if (sendingRecords.length === 0 && (sendingLatest.records?.length ?? 0) > 0) {
      sendingRecords = sendingLatest.records ?? []
    }

    let inboundRecords = parsed.inboundRecords
    let inboundDomainStatus = 'not_configured'

    if (parsed.resendInboundDomainId) {
      const inboundLatest = await loadResendDomainWithRecords(parsed.resendInboundDomainId)
      inboundRecords = inboundLatest.records ?? []
      inboundDomainStatus = mapResendStatus(inboundLatest.status)
    }

    await db
      .update(accounts)
      .set({
        outreachDomainStatus: mapResendStatus(sendingLatest.status),
        outreachDomainDns: {
          sendingRecords,
          inboundRecords,
          resendInboundDomainId: parsed.resendInboundDomainId,
        },
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    revalidatePath('/admin/settings')

    const refreshed = await getOutreachDomainSettings()
    if (!refreshed.success || !refreshed.data) {
      return { success: false, error: 'Records refreshed but settings could not be reloaded' }
    }

    return { success: true, data: refreshed.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not refresh DNS records',
    }
  }
}

export async function verifyOutreachDomain(): Promise<ActionResult<OutreachDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const account = await loadAccountDomainRow(accountId)

    if (!account?.resendOutreachDomainId) {
      return { success: false, error: 'Add a domain before verifying' }
    }

    await verifyResendDomain(account.resendOutreachDomainId)
    const sendingLatest = await loadResendDomainWithRecords(account.resendOutreachDomainId)
    const sendingStatus = mapResendStatus(sendingLatest.status)

    const parsed = parseStoredDomainDns(account.outreachDomainDns)
    let inboundRecords = parsed.inboundRecords
    let inboundStatus = 'not_configured'

    if (parsed.resendInboundDomainId) {
      try {
        await verifyResendDomain(parsed.resendInboundDomainId)
        const inboundLatest = await loadResendDomainWithRecords(parsed.resendInboundDomainId)
        inboundRecords = inboundLatest.records ?? []
        inboundStatus = mapResendStatus(inboundLatest.status)
      } catch {
        inboundStatus = 'pending'
      }
    }

    let { sendingRecords } = partitionDnsRecords(sendingLatest.records ?? [])
    if (sendingRecords.length === 0 && (sendingLatest.records?.length ?? 0) > 0) {
      sendingRecords = sendingLatest.records ?? []
    }

    await db
      .update(accounts)
      .set({
        outreachDomainStatus: sendingStatus,
        outreachDomainDns: {
          sendingRecords,
          inboundRecords,
          resendInboundDomainId: parsed.resendInboundDomainId,
        },
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    revalidatePath('/admin/settings')

    const refreshed = await getOutreachDomainSettings()
    if (!refreshed.success || !refreshed.data) {
      return { success: false, error: 'Verification ran but settings could not be reloaded' }
    }

    return { success: true, data: refreshed.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Domain verification failed',
    }
  }
}

export async function clearOutreachDomain(): Promise<ActionResult<{ cleared: true }>> {
  try {
    const accountId = await assertAdminAccess()

    await db
      .update(accounts)
      .set({
        outreachFromDomain: null,
        outreachInboundDomain: null,
        outreachFromLocalPart: 'outreach',
        outreachDomainStatus: 'not_configured',
        resendOutreachDomainId: null,
        outreachDomainDns: {},
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    revalidatePath('/admin/settings')
    return { success: true, data: { cleared: true } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not reset outreach domain',
    }
  }
}
