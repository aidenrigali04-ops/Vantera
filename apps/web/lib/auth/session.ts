import {
  ADMIN_SESSION_COOKIE,
  PORTAL_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/constants'
import { verifySessionToken, signSessionToken } from '@/lib/auth/jwt'
import type { AdminSession, PortalSession } from '@/lib/auth/types'
import { cookies } from 'next/headers'

// In production we scope the session cookie to the parent domain
// (e.g. .vantera.app) so it travels across tenant subdomains. Without this
// the cookie set on the marketing apex during signup wouldn't be sent to
// <slug>.vantera.app and the user would land logged out.
function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN
  if (!appDomain) return undefined
  return appDomain.startsWith('.') ? appDomain : `.${appDomain}`
}

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
}

const cookieOptions = (() => {
  const domain = getCookieDomain()
  return domain ? { ...baseCookieOptions, domain } : baseCookieOptions
})()

export async function setAdminSession(session: AdminSession): Promise<void> {
  const token = await signSessionToken(session)
  cookies().set(ADMIN_SESSION_COOKIE, token, cookieOptions)
}

export async function setPortalSession(session: PortalSession): Promise<void> {
  const token = await signSessionToken(session)
  cookies().set(PORTAL_SESSION_COOKIE, token, cookieOptions)
}

export async function clearAdminSession(): Promise<void> {
  cookies().set(ADMIN_SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 })
}

export async function clearPortalSession(): Promise<void> {
  cookies().set(PORTAL_SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 })
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value

  if (!token) {
    return null
  }

  const payload = await verifySessionToken(token)

  if (!payload || payload.type !== 'admin') {
    return null
  }

  return payload
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const token = cookies().get(PORTAL_SESSION_COOKIE)?.value

  if (!token) {
    return null
  }

  const payload = await verifySessionToken(token)

  if (!payload || payload.type !== 'portal') {
    return null
  }

  return payload
}
