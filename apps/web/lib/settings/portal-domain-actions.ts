'use server'

import type { ActionResult } from '@/lib/auth/types'
import { ROLE_RANK } from '@/lib/auth/constants'
import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { derivePortalLoginUrl, derivePortalUrl } from '@/lib/portal/url'
import {
  buildDefaultPortalDnsRecords,
  isReservedPlatformHost,
  isValidPortalDomain,
  normalizePortalDomain,
  parsePortalDomainDns,
  type PortalDomainDnsPayload,
} from '@/lib/portal/domain-utils'
import {
  isVercelDomainProvisioningEnabled,
  registerPortalDomainOnVercel,
} from '@/lib/vercel/project-domains'
import { accounts } from '@vantera/db'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type PortalDomainSettings = {
  portalDomain: string | null
  domainStatus: string
  dns: PortalDomainDnsPayload
  portalUrl: string
  portalLoginUrl: string
  platformLoginUrl: string
  vercelAutoProvision: boolean
}

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

async function assertAdminAccess(): Promise<string> {
  const session = await getAdminSession()
  if (!session) throw new Error('Your session expired. Refresh and sign in again.')
  if ((ROLE_RANK[session.role] ?? 0) < ROLE_RANK.admin) {
    throw new Error('You do not have permission to change portal settings.')
  }
  return session.accountId
}

async function loadAccountPortalRow(accountId: string) {
  const [row] = await db
    .select({
      slug: accounts.slug,
      portalDomain: accounts.portalDomain,
      portalDomainStatus: accounts.portalDomainStatus,
      portalDomainDns: accounts.portalDomainDns,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return row ?? null
}

function buildSettingsFromRow(
  row: NonNullable<Awaited<ReturnType<typeof loadAccountPortalRow>>>,
): PortalDomainSettings {
  const dns = parsePortalDomainDns(row.portalDomainDns)
  const portalOpts = { portalDomainStatus: row.portalDomainStatus }

  return {
    portalDomain: row.portalDomain,
    domainStatus: row.portalDomainStatus ?? 'not_configured',
    dns,
    portalUrl: derivePortalUrl(row.slug, row.portalDomain, portalOpts),
    portalLoginUrl: derivePortalLoginUrl(row.slug, row.portalDomain, portalOpts),
    platformLoginUrl: derivePortalLoginUrl(row.slug, null),
    vercelAutoProvision: isVercelDomainProvisioningEnabled(),
  }
}

export async function getPortalDomainSettings(): Promise<ActionResult<PortalDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const row = await loadAccountPortalRow(accountId)
    if (!row) return err('Workspace not found')

    return { success: true, data: buildSettingsFromRow(row) }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Could not load portal domain settings')
  }
}

async function assertDomainAvailable(
  accountId: string,
  hostname: string,
): Promise<ActionResult<true>> {
  const [conflict] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.portalDomain, hostname), ne(accounts.id, accountId)))
    .limit(1)

  if (conflict) {
    return err('This domain is already used by another workspace.')
  }

  return { success: true, data: true }
}

export async function savePortalDomain(input: {
  portalDomain: string
}): Promise<ActionResult<PortalDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const row = await loadAccountPortalRow(accountId)
    if (!row) return err('Workspace not found')

    const hostname = normalizePortalDomain(input.portalDomain)

    if (!hostname) {
      await db
        .update(accounts)
        .set({
          portalDomain: null,
          portalDomainStatus: 'not_configured',
          portalDomainDns: {},
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId))

      revalidatePath('/admin/settings')
      revalidatePath('/admin/portal')

      const cleared = await loadAccountPortalRow(accountId)
      if (!cleared) return err('Workspace not found')
      return { success: true, data: buildSettingsFromRow(cleared) }
    }

    if (!isValidPortalDomain(hostname)) {
      return err('Enter a valid hostname like portal.yourcompany.com')
    }

    if (isReservedPlatformHost(hostname)) {
      return err('Use your own business domain, not the Vantera platform domain.')
    }

    const availability = await assertDomainAvailable(accountId, hostname)
    if (!availability.success) return availability

    let dns = buildDefaultPortalDnsRecords(hostname)
    let status: string = 'pending'

    if (isVercelDomainProvisioningEnabled()) {
      const vercel = await registerPortalDomainOnVercel(hostname)
      if (vercel.ok && vercel.records.length > 0) {
        dns = {
          ...dns,
          records: vercel.records,
          vercelConfigured: true,
        }
      }
    }

    await db
      .update(accounts)
      .set({
        portalDomain: hostname,
        portalDomainStatus: status,
        portalDomainDns: dns,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    revalidatePath('/admin/settings')
    revalidatePath('/admin/portal')
    revalidatePath('/admin/clients')

    const updated = await loadAccountPortalRow(accountId)
    if (!updated) return err('Workspace not found')
    return { success: true, data: buildSettingsFromRow(updated) }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Could not save portal domain')
  }
}

export async function verifyPortalDomain(): Promise<ActionResult<PortalDomainSettings>> {
  try {
    const accountId = await assertAdminAccess()
    const row = await loadAccountPortalRow(accountId)
    if (!row?.portalDomain) {
      return err('Add a portal domain before verifying.')
    }

    const hostname = row.portalDomain
    let verified = false
    let failureReason = 'Could not reach your domain. Check DNS and try again.'

    try {
      const response = await fetch(`https://${hostname}/api/health`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      })
      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { ok?: boolean } | null
        if (body?.ok === true) {
          verified = true
        } else {
          failureReason =
            'Domain responded but is not serving Vantera yet. Confirm the CNAME and Vercel domain setup.'
        }
      } else {
        failureReason = `Domain returned HTTP ${response.status}. DNS may still be propagating.`
      }
    } catch {
      verified = false
    }

    const dns = parsePortalDomainDns(row.portalDomainDns)
    const nextDns: PortalDomainDnsPayload = {
      ...dns,
      lastCheckedAt: new Date().toISOString(),
    }

    await db
      .update(accounts)
      .set({
        portalDomainStatus: verified ? 'verified' : 'failed',
        portalDomainDns: nextDns,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    revalidatePath('/admin/settings')
    revalidatePath('/admin/portal')
    revalidatePath('/admin/clients')

    const updated = await loadAccountPortalRow(accountId)
    if (!updated) return err('Workspace not found')

    if (!verified) {
      return err(failureReason)
    }

    return { success: true, data: buildSettingsFromRow(updated) }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Verification failed')
  }
}

export async function clearPortalDomain(): Promise<ActionResult<PortalDomainSettings>> {
  return savePortalDomain({ portalDomain: '' })
}
