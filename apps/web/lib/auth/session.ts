import {
  ADMIN_SESSION_COOKIE,
  PORTAL_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/constants'
import { verifySessionToken, signSessionToken } from '@/lib/auth/jwt'
import type { AdminSession, PortalSession } from '@/lib/auth/types'
import { cookies, headers } from 'next/headers'

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
}

// Returns the cookie `domain` attribute to use for the current request,
// or undefined to fall back to a host-only cookie.
//
// Browsers reject any `Set-Cookie` whose `domain` attribute doesn't match
// the request host. So we can ONLY scope the cookie to .<NEXT_PUBLIC_APP_DOMAIN>
// when the current request is actually on that domain. On *.vercel.app /
// localhost / lvh.me / etc. we must emit a host-only cookie or it will
// silently fail to set — which is exactly what was breaking signup on
// Vercel preview URLs.
//
// Vercel-managed hosts (`*.vercel.app`) also get a host-only cookie even
// when they happen to match the appDomain: there's no wildcard SSL for
// sub-subdomains on vercel.app, so the cross-subdomain cookie scope has
// no value and just risks PSL-related rejection.
function getCookieDomainForCurrentRequest(): string | undefined {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN
  if (!appDomain) return undefined

  const normalized = appDomain.startsWith('.') ? appDomain.slice(1) : appDomain
  if (normalized === 'vercel.app' || normalized.endsWith('.vercel.app')) {
    return undefined
  }

  let host: string
  try {
    host = headers().get('host') ?? ''
  } catch {
    return undefined
  }

  const hostname = host.split(':')[0] ?? ''
  if (!hostname) return undefined

  const matchesAppDomain =
    hostname === normalized || hostname.endsWith(`.${normalized}`)

  return matchesAppDomain ? `.${normalized}` : undefined
}

function buildCookieOptions() {
  const domain = getCookieDomainForCurrentRequest()
  return domain ? { ...baseCookieOptions, domain } : baseCookieOptions
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const token = await signSessionToken(session)
  cookies().set(ADMIN_SESSION_COOKIE, token, buildCookieOptions())
}

export async function setPortalSession(session: PortalSession): Promise<void> {
  const token = await signSessionToken(session)
  cookies().set(PORTAL_SESSION_COOKIE, token, buildCookieOptions())
}

/**
 * Delete a session cookie across BOTH possible scopes — the `.<appDomain>`
 * domain cookie set by current deploys AND a host-only cookie that older
 * deploys (or empty-env builds) may have left behind. When both exist the
 * browser sends both and the server reads an arbitrary one, which caused
 * "log in succeeds then bounces straight back to sign-on." Clearing both
 * scopes on every login/logout/signup makes stale sessions self-heal.
 */
function clearCookieAllScopes(name: string): void {
  const opts = buildCookieOptions()
  // current scope (domain-scoped when on the app domain, host-only otherwise)
  cookies().set(name, '', { ...opts, maxAge: 0 })
  // the opposite scope, so a leftover cookie can't survive
  if ('domain' in opts && opts.domain) {
    const { domain: _omit, ...hostOnly } = opts
    cookies().set(name, '', { ...hostOnly, maxAge: 0 })
  } else {
    const domain = getCookieDomainForCurrentRequest()
    if (domain) cookies().set(name, '', { ...baseCookieOptions, domain, maxAge: 0 })
  }
}

export async function clearAdminSession(): Promise<void> {
  clearCookieAllScopes(ADMIN_SESSION_COOKIE)
}

export async function clearPortalSession(): Promise<void> {
  clearCookieAllScopes(PORTAL_SESSION_COOKIE)
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

  const userId = typeof payload.userId === 'string' ? payload.userId.trim() : ''
  const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const role = payload.role

  if (!userId || !accountId || !email || typeof role !== 'string') {
    return null
  }

  return {
    type: 'admin',
    userId,
    accountId,
    role: role as AdminSession['role'],
    email,
  }
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
