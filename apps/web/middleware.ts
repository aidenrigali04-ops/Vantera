import {
  ADMIN_SESSION_COOKIE,
  PORTAL_SESSION_COOKIE,
} from '@/lib/auth/constants'
import { verifySessionToken } from '@/lib/auth/jwt'
import { canAccessAdminRoute } from '@/lib/auth/rbac'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
  return pathname.startsWith('/auth')
}

function applyAccountHeaders(
  requestHeaders: Headers,
  response: NextResponse,
  account: AccountRow,
): void {
  const headerValues: Record<string, string> = {
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

  const requestHeaders = new Headers(request.headers)
  const brandedResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  applyAccountHeaders(requestHeaders, brandedResponse, account)

  if (pathname.startsWith('/admin')) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const payload = await verifySessionToken(sessionToken)

    if (!payload || payload.type !== 'admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (payload.accountId !== account.id) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (!canAccessAdminRoute(payload.role, pathname)) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
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

    if (payload.accountId !== account.id) {
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
