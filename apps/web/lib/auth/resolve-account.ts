import type { BrandingData } from '@/lib/branding/context'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

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
  const supabase = createSupabaseServerClient()
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'vantera.app'
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
