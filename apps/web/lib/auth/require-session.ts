import { getBrandingFromHeaders } from '@/lib/branding/server'
import type { BrandingData } from '@/lib/branding/context'
import { getAdminSession, getPortalSession } from '@/lib/auth/session'
import type { AdminSession, PortalSession } from '@/lib/auth/types'
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
    redirect('/auth/login')
  }

  const branding = getBrandingFromHeaders(headers())

  if (branding.accountId && String(session.accountId) !== String(branding.accountId)) {
    redirect('/auth/login')
  }

  return session
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
