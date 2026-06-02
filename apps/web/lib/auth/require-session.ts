import { getBrandingFromHeaders } from '@/lib/branding/server'
import type { BrandingData } from '@/lib/branding/context'
import { AUTH_LOGIN_ENTRY } from '@/lib/auth/routes'
import { getAdminSession, getPortalSession } from '@/lib/auth/session'
import type { AdminSession, PortalSession } from '@/lib/auth/types'
import { resolveSessionWorkspace } from '@/lib/onboarding/resolve-session-workspace'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession()

  if (!session) {
    redirect(AUTH_LOGIN_ENTRY)
  }

  try {
    const { session: synced } = await resolveSessionWorkspace(session, { refreshSession: false })
    return synced
  } catch {
    redirect(AUTH_LOGIN_ENTRY)
  }
}

/** Bind session to live users row; refresh cookie (API routes / server actions only). */
export async function getSyncedAdminSession(): Promise<AdminSession | null> {
  const session = await getAdminSession()
  if (!session) return null

  try {
    const { session: synced } = await resolveSessionWorkspace(session, { refreshSession: true })
    return synced
  } catch (err) {
    console.error('[getSyncedAdminSession]', err)
    return null
  }
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
