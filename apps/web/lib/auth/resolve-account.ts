import type { BrandingData } from '@/lib/branding/context'
import { ADMIN_SESSION_COOKIE, PORTAL_SESSION_COOKIE } from '@/lib/auth/constants'
import { verifySessionToken } from '@/lib/auth/jwt'
import { getSupabaseAdmin as createSupabaseAdminClient } from '@/lib/supabase/admin'
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
    onboardingKnown: true,
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

    return null
  } catch {
    return null
  }
}

/**
 * Find an account by an admin user's email.
 *
 * Used by the login action as a fallback when the request's host doesn't
 * map to a tenant subdomain — e.g. a user signing in from the marketing
 * apex, the bare *.vercel.app URL, or localhost. We trust the lookup
 * because the user must then prove the password against Supabase Auth.
 *
 * If the email belongs to multiple accounts we return the first match.
 * A multi-workspace picker is out of scope for the MVP.
 */
export async function findAccountByAdminEmail(email: string): Promise<AccountRow | null> {
  try {
    // Anon-key reads on `users` are blocked by RLS — we deliberately use the
    // service-role client here so the lookup actually returns rows.
    const supabase = createSupabaseAdminClient()
    const normalized = email.toLowerCase().trim()

    // ORDER BY created_at DESC: a single email can legitimately own multiple
    // workspaces. We always route to the most recently created one — that's
    // the workspace the user was just interacting with. Without the order
    // clause Postgres returns "some" row and routing becomes non-deterministic
    // (the original tenant-bleed bug).
    const { data: userRow } = await supabase
      .from('users')
      .select('account_id, created_at')
      .eq('email', normalized)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!userRow?.account_id) return null

    const { data: account } = await supabase
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('id', userRow.account_id)
      .limit(1)
      .maybeSingle()

    return account ?? null
  } catch {
    return null
  }
}

/**
 * Find an account by a portal contact's email.
 */
export async function findAccountByPortalEmail(email: string): Promise<AccountRow | null> {
  try {
    const supabase = createSupabaseAdminClient()
    const normalized = email.toLowerCase().trim()

    const { data: contactRow } = await supabase
      .from('contacts')
      .select('account_id, created_at')
      .eq('email', normalized)
      .eq('portal_access', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!contactRow?.account_id) return null

    const { data: account } = await supabase
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('id', contactRow.account_id)
      .limit(1)
      .maybeSingle()

    return account ?? null
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
      onboardingKnown: false,
    }
  }

  return accountToBranding(account)
}

export async function resolveAccountIdFromRequest(): Promise<string | null> {
  const host = headers().get('host') ?? ''
  const account = await resolveAccountFromHost(host)
  return account?.id ?? null
}
