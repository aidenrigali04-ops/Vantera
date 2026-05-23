import type { BrandingData } from '@/lib/branding/context'
import { ADMIN_SESSION_COOKIE, PORTAL_SESSION_COOKIE } from '@/lib/auth/constants'
import { verifySessionToken } from '@/lib/auth/jwt'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import { cookies, headers } from 'next/headers'

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

function accountToBranding(account: AccountRow): BrandingData {
  return {
    accountId: account.id,
    businessName: account.name,
    logoUrl: account.brand_logo_url,
    primaryColor: account.brand_primary_color ?? '#1648A0',
    secondaryColor: account.brand_secondary_color ?? '#0D9488',
    vertical: account.vertical,
    plan: account.plan,
    portalDomain: account.portal_domain ?? '',
    onboardingComplete: Boolean(account.onboarding_completed_at),
  }
}

export async function resolveAccountFromHost(host: string): Promise<AccountRow | null> {
  try {
    const supabase = createSupabasePublicClient()
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'vantera.app'
    const hostname = host.split(':')[0] ?? ''

    if (hostname && hostname.endsWith(`.${appDomain}`)) {
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

    if (hostname) {
      const { data } = await supabase
        .from('accounts')
        .select(ACCOUNT_SELECT)
        .eq('portal_domain', hostname)
        .limit(1)
        .maybeSingle()

      if (data) {
        return data
      }
    }

    // Session fallback: a freshly-signed-up user is on the marketing apex
    // (or a bare *.vercel.app) until custom DNS is set up. Verify the session
    // cookie and resolve the tenant by the embedded accountId so they can
    // reach /admin/onboarding without leaving the host they signed up on.
    const cookieStore = cookies()
    const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    if (adminToken) {
      const payload = await verifySessionToken(adminToken)
      if (payload && payload.type === 'admin' && payload.accountId) {
        const { data } = await supabase
          .from('accounts')
          .select(ACCOUNT_SELECT)
          .eq('id', payload.accountId)
          .limit(1)
          .maybeSingle()

        if (data) return data
      }
    }

    const portalToken = cookieStore.get(PORTAL_SESSION_COOKIE)?.value
    if (portalToken) {
      const payload = await verifySessionToken(portalToken)
      if (payload && payload.type === 'portal' && payload.accountId) {
        const { data } = await supabase
          .from('accounts')
          .select(ACCOUNT_SELECT)
          .eq('id', payload.accountId)
          .limit(1)
          .maybeSingle()

        if (data) return data
      }
    }

    // Fallback: TEST_TENANT_SLUG lets you test on bare deployment URLs
    // (e.g. *.vercel.app) before configuring custom DNS. Leave unset in
    // production once real tenant subdomains are wired up.
    const testSlug = process.env.TEST_TENANT_SLUG

    if (testSlug) {
      const { data } = await supabase
        .from('accounts')
        .select(ACCOUNT_SELECT)
        .eq('slug', testSlug)
        .limit(1)
        .maybeSingle()

      if (data) {
        return data
      }
    }

    return null
  } catch {
    return null
  }
}

export async function resolveBrandingFromRequest(): Promise<BrandingData> {
  const host = headers().get('host') ?? ''
  const account = await resolveAccountFromHost(host)

  if (!account) {
    return {
      accountId: '',
      businessName: '',
      logoUrl: null,
      primaryColor: '#1648A0',
      secondaryColor: '#0D9488',
      vertical: '',
      plan: 'team',
      portalDomain: '',
      onboardingComplete: false,
    }
  }

  return accountToBranding(account)
}

export async function resolveAccountIdFromRequest(): Promise<string | null> {
  const host = headers().get('host') ?? ''
  const account = await resolveAccountFromHost(host)
  return account?.id ?? null
}
