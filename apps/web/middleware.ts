import {
  ADMIN_SESSION_COOKIE,
  PORTAL_SESSION_COOKIE,
} from '@/lib/auth/constants'
import { verifySessionToken } from '@/lib/auth/jwt'
import type { AdminSession } from '@/lib/auth/types'
import { canAccessAdminRoute } from '@/lib/auth/rbac'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

type AccountRow = {
  id: string
  slug: string
  name: string
  vertical: string
  plan: string
  brand_logo_url: string | null
  brand_primary_color: string | null
  brand_secondary_color: string | null
  portal_domain: string | null
  onboarding_completed_at: string | null
}

const ACCOUNT_SELECT =
  'id, slug, name, vertical, plan, brand_logo_url, brand_primary_color, brand_secondary_color, portal_domain, onboarding_completed_at'

function shouldSkipTenantResolution(pathname: string): boolean {
  return (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname === '/' ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}

function isMarketingHost(hostname: string, appDomain: string): boolean {
  if (!hostname) return true
  if (hostname === appDomain) return true
  if (hostname === `www.${appDomain}`) return true
  if (hostname.endsWith('.vercel.app')) return true
  return false
}

/** Server Actions POST with this header — middleware must NOT redirect them. */
function isServerActionRequest(request: NextRequest): boolean {
  return (
    request.method === 'POST' &&
    (request.headers.has('Next-Action') || request.headers.has('next-action'))
  )
}

function applySessionFallbackHeaders(
  requestHeaders: Headers,
  response: NextResponse,
  accountId: string,
  pathname: string,
): void {
  const headerValues: Record<string, string> = {
    'x-pathname': pathname,
    'x-account-id': accountId,
    'x-onboarding-complete': 'false',
  }

  for (const [key, value] of Object.entries(headerValues)) {
    requestHeaders.set(key, value)
    response.headers.set(key, value)
  }
}

function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

async function resolveAccountById(accountId: string): Promise<AccountRow | null> {
  const service = createServiceRoleClient()
  const { data } = await service
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('id', accountId)
    .limit(1)
    .maybeSingle()

  return data ?? null
}

function applyAccountHeaders(
  requestHeaders: Headers,
  response: NextResponse,
  account: AccountRow,
  pathname: string,
): void {
  const headerValues: Record<string, string> = {
    'x-pathname': pathname,
    'x-account-id': account.id,
    'x-account-slug': account.slug,
    'x-account-vertical': account.vertical,
    'x-account-plan': account.plan,
    'x-brand-name': account.name,
    'x-brand-logo-url': account.brand_logo_url ?? '',
    'x-brand-primary': account.brand_primary_color ?? '#1648A0',
    'x-brand-secondary': account.brand_secondary_color ?? '#0D9488',
    'x-portal-domain': account.portal_domain ?? '',
    'x-onboarding-complete': account.onboarding_completed_at ? 'true' : 'false',
  }

  for (const [key, value] of Object.entries(headerValues)) {
    requestHeaders.set(key, value)
    response.headers.set(key, value)
  }
}

async function resolveAccountByHost(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  host: string,
  appDomain: string,
  verifiedAdmin: AdminSession | null,
): Promise<AccountRow | null> {
  const hostname = host.split(':')[0] ?? ''

  if (hostname.endsWith(`.${appDomain}`)) {
    const dotIndex = hostname.indexOf('.')
    const slug = dotIndex === -1 ? '' : hostname.slice(0, dotIndex)

    if (slug) {
      const { data } = await supabase
        .from('accounts')
        .select(ACCOUNT_SELECT)
        .eq('slug', slug)
        .limit(1)
        .maybeSingle()

      if (data) {
        return data
      }
    }
  }

  const { data: portalAccount } = await supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('portal_domain', hostname)
    .limit(1)
    .maybeSingle()

  if (portalAccount) {
    return portalAccount
  }

  // Session fallback: when a freshly-signed-up user is still on the marketing
  // apex (or *.vercel.app, or localhost) before custom DNS is wired up, their
  // admin session cookie is the only signal that tells us which tenant they
  // belong to. Verify the cookie, then look up the account by the embedded ID.
  // Use the service-role client so RLS / anon edge quirks can't block lookup.
  if (verifiedAdmin?.accountId) {
    const bySession = await resolveAccountById(String(verifiedAdmin.accountId))
    if (bySession) {
      return bySession
    }
  }

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (adminToken && !verifiedAdmin) {
    const payload = await verifySessionToken(adminToken)
    if (payload && payload.type === 'admin' && payload.accountId) {
      const bySession = await resolveAccountById(String(payload.accountId))
      if (bySession) {
        return bySession
      }
    }
  }

  const portalToken = request.cookies.get(PORTAL_SESSION_COOKIE)?.value
  if (portalToken) {
    const payload = await verifySessionToken(portalToken)
    if (payload && payload.type === 'portal' && payload.accountId) {
      const bySession = await resolveAccountById(String(payload.accountId))
      if (bySession) {
        return bySession
      }
    }
  }

  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (shouldSkipTenantResolution(pathname)) {
    return NextResponse.next()
  }

  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0] ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'vantera.app'

  // A valid session cookie means the user has a real account — let
  // resolveAccountByHost figure out which tenant via the session fallback,
  // even on marketing/apex/*.vercel.app hosts. Without this guard a fresh
  // signup on a Vercel preview URL would be bounced back to the landing
  // page before middleware ever got a chance to read its admin session.
  const hasAdminSession = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  const hasPortalSession = Boolean(request.cookies.get(PORTAL_SESSION_COOKIE)?.value)
  const hasAnySession = hasAdminSession || hasPortalSession

  if (isMarketingHost(hostname, appDomain) && !hasAnySession) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const adminPayload = adminToken ? await verifySessionToken(adminToken) : null
  const verifiedAdmin =
    adminPayload?.type === 'admin' && adminPayload.accountId ? adminPayload : null

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const account = await resolveAccountByHost(supabase, request, host, appDomain, verifiedAdmin)
  const isAction = isServerActionRequest(request)
  const adminRouteWithSession = pathname.startsWith('/admin') && Boolean(verifiedAdmin)

  // Page navigations need a resolved tenant unless the user has a verified
  // admin session on /admin/* (post-signup on apex / preview URLs). Server
  // Actions must never be redirected — that breaks the RSC action payload.
  if (!account && !isAction && !adminRouteWithSession) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const requestHeaders = new Headers(request.headers)
  const brandedResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (account) {
    applyAccountHeaders(requestHeaders, brandedResponse, account, pathname)
  } else if (verifiedAdmin?.accountId) {
    applySessionFallbackHeaders(
      requestHeaders,
      brandedResponse,
      String(verifiedAdmin.accountId),
      pathname,
    )
  }

  if (pathname.startsWith('/admin') && !isAction) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const payload = await verifySessionToken(sessionToken)

    if (!payload || payload.type !== 'admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (account && String(payload.accountId) !== String(account.id)) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (!canAccessAdminRoute(payload.role, pathname)) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    const onboardingIncomplete = account ? !account.onboarding_completed_at : true

    // Onboarding gate: an owner whose account hasn't completed onboarding
    // is held on /admin/onboarding regardless of what /admin/* path they
    // try to hit. This catches anything the signup / OAuth redirects
    // might miss (stale deep links, page refreshes mid-wizard, etc.).
    // Non-owner roles bypass — they shouldn't be running the wizard.
    if (
      payload.role === 'owner' &&
      onboardingIncomplete &&
      !pathname.startsWith('/admin/onboarding')
    ) {
      return NextResponse.redirect(new URL('/admin/onboarding', request.url))
    }
  }

  if (pathname.startsWith('/portal')) {
    const sessionToken = request.cookies.get(PORTAL_SESSION_COOKIE)?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/auth/portal-login', request.url))
    }

    const payload = await verifySessionToken(sessionToken)

    if (!payload || payload.type !== 'portal') {
      return NextResponse.redirect(new URL('/auth/portal-login', request.url))
    }

    if (!account || String(payload.accountId) !== String(account.id)) {
      return NextResponse.redirect(new URL('/auth/portal-login', request.url))
    }
  }

  response.cookies.getAll().forEach(({ name, value }) => {
    brandedResponse.cookies.set(name, value)
  })

  return brandedResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
