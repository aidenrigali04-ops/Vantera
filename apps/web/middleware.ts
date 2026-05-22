import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { jwtVerify } from 'jose'
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

const ADMIN_SESSION_COOKIE = 'v_admin_session'
const PORTAL_SESSION_COOKIE = 'v_portal_session'

const ROLE_RANK: Record<string, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  staff: 3,
  technician: 2,
  agent: 1,
}

const ADMIN_ROUTE_MIN_RANK: Array<{ prefix: string; minRank: number }> = [
  { prefix: '/admin/billing', minRank: 6 },
  { prefix: '/admin/settings', minRank: 5 },
  { prefix: '/admin/team', minRank: 4 },
  { prefix: '/admin/automations', minRank: 4 },
]

const ACCOUNT_SELECT =
  'id, slug, name, vertical, plan, brand_logo_url, brand_primary_color, brand_secondary_color, portal_domain, onboarding_completed_at'

function shouldSkipTenantResolution(pathname: string): boolean {
  if (pathname.startsWith('/auth')) {
    return true
  }

  if (pathname === '/api/health') {
    return true
  }

  return false
}

function getRequiredRoleRank(pathname: string): number {
  for (const route of ADMIN_ROUTE_MIN_RANK) {
    if (pathname.startsWith(route.prefix)) {
      return route.minRank
    }
  }

  return 0
}

function hasSufficientRole(role: string, requiredRank: number): boolean {
  if (requiredRank === 0) {
    return true
  }

  return (ROLE_RANK[role] ?? 0) >= requiredRank
}

function getAccountIdFromPayload(payload: Record<string, unknown>): string | null {
  const accountId = payload.accountId ?? payload.account_id
  return typeof accountId === 'string' ? accountId : null
}

function getRoleFromPayload(payload: Record<string, unknown>): string | null {
  const role = payload.role
  return typeof role === 'string' ? role : null
}

async function decodeSessionToken(token: string): Promise<Record<string, unknown> | null> {
  const secret = process.env.SUPABASE_JWT_SECRET

  if (!secret) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

function buildBrandingHeaders(request: NextRequest, account: AccountRow): Headers {
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set('x-account-id', account.id)
  requestHeaders.set('x-account-slug', account.slug)
  requestHeaders.set('x-account-vertical', account.vertical)
  requestHeaders.set('x-account-plan', account.plan)
  requestHeaders.set('x-brand-name', account.name)
  requestHeaders.set('x-brand-logo-url', account.brand_logo_url ?? '')
  requestHeaders.set('x-brand-primary', account.brand_primary_color ?? '#1648A0')
  requestHeaders.set('x-brand-secondary', account.brand_secondary_color ?? '#0D9488')
  requestHeaders.set('x-portal-domain', account.portal_domain ?? '')
  requestHeaders.set('x-onboarding-complete', account.onboarding_completed_at ? 'true' : 'false')

  return requestHeaders
}

async function resolveAccountByHost(
  supabase: ReturnType<typeof createServerClient>,
  host: string,
  appDomain: string,
): Promise<AccountRow | null> {
  const hostname = host.split(':')[0] ?? ''

  if (hostname.endsWith(`.${appDomain}`)) {
    const dotIndex = hostname.indexOf('.')
    const slug = dotIndex === -1 ? '' : hostname.slice(0, dotIndex)

    if (!slug) {
      return null
    }

    const { data } = await supabase
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()

    return data
  }

  const { data } = await supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('portal_domain', hostname)
    .limit(1)
    .maybeSingle()

  return data
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (shouldSkipTenantResolution(pathname)) {
    return NextResponse.next()
  }

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

  const host = request.headers.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'vantera.app'
  const account = await resolveAccountByHost(supabase, host, appDomain)

  if (!account) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const requestHeaders = buildBrandingHeaders(request, account)

  if (pathname.startsWith('/admin')) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const payload = await decodeSessionToken(sessionToken)

    if (!payload) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const sessionAccountId = getAccountIdFromPayload(payload)

    if (!sessionAccountId || sessionAccountId !== account.id) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const role = getRoleFromPayload(payload)

    if (!role || !hasSufficientRole(role, getRequiredRoleRank(pathname))) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  if (pathname.startsWith('/portal')) {
    const sessionToken = request.cookies.get(PORTAL_SESSION_COOKIE)?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/auth/portal-login', request.url))
    }

    const payload = await decodeSessionToken(sessionToken)

    if (!payload) {
      return NextResponse.redirect(new URL('/auth/portal-login', request.url))
    }

    const sessionAccountId = getAccountIdFromPayload(payload)

    if (!sessionAccountId || sessionAccountId !== account.id) {
      return NextResponse.redirect(new URL('/auth/portal-login', request.url))
    }
  }

  const brandedResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.cookies.getAll().forEach(({ name, value }) => {
    brandedResponse.cookies.set(name, value)
  })

  return brandedResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
