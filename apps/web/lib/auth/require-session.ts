import { getBrandingFromHeaders } from '@/lib/branding/server'
import type { BrandingData } from '@/lib/branding/context'
import { AUTH_LOGIN_ENTRY } from '@/lib/auth/routes'
import { getAdminSession, getPortalSession, setAdminSession } from '@/lib/auth/session'
import type { AdminSession, PortalSession } from '@/lib/auth/types'
import { resolveWorkspaceAccountId } from '@/lib/onboarding/account-store'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

async function syncSessionAccountId(session: AdminSession): Promise<AdminSession> {
  const resolvedAccountId = await resolveWorkspaceAccountId(session.userId)

  if (!resolvedAccountId || resolvedAccountId === session.accountId) {
    return session
  }

  const synced: AdminSession = { ...session, accountId: resolvedAccountId }
  await setAdminSession(synced)
  return synced
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession()

  if (!session) {
    redirect(AUTH_LOGIN_ENTRY)
  }

  const syncedSession = await syncSessionAccountId(session)

  return syncedSession
}

/** Resolve session accountId from the users row (for API routes). Updates cookie when stale. */
export async function getSyncedAdminSession(): Promise<AdminSession | null> {
  const session = await getAdminSession()
  if (!session) return null
  return syncSessionAccountId(session)
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession()

  if (!session) {
    redirect('/auth/portal-login')
  }

  const branding = getBrandingFromHeaders(headers())

  if (branding.accountId && session.accountId !== branding.accountId) {
    redirect('/auth/portal-login')
  }

  return session
}

export async function getBrandingOrEmpty(): Promise<BrandingData> {
  return getBrandingFromHeaders(headers())
}
