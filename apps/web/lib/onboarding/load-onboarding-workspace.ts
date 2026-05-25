import type { AdminSession } from '@/lib/auth/types'
import type { BrandingData } from '@/lib/branding/context'
import type { AccountRow } from './account-store'
import { fetchAccountById } from './account-store'

export type OnboardingWorkspace = {
  accountId: string
  account: AccountRow | null
  businessName: string
  currentVertical: string | null
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  portalDomain: string
  onboardingComplete: boolean
}

/**
 * Bootstrap onboarding from the admin session + middleware branding headers.
 * Avoids throwing when the Supabase JS admin client fails to init on Vercel —
 * the page should render for a freshly minted signup session even if a DB
 * round-trip is temporarily unavailable.
 */
export async function loadOnboardingWorkspace(
  session: AdminSession,
  branding: BrandingData,
): Promise<OnboardingWorkspace> {
  const accountId = String(session.accountId).trim()

  let account: AccountRow | null = null
  if (accountId) {
    try {
      account = await fetchAccountById(accountId)
    } catch (err) {
      console.error('[loadOnboardingWorkspace] fetchAccountById failed', err)
    }
  }

  const onboardingComplete =
    branding.onboardingComplete || Boolean(account?.onboarding_completed_at)

  return {
    accountId,
    account,
    businessName: account?.name || branding.businessName,
    currentVertical: account?.vertical || branding.vertical || null,
    primaryColor: account?.brand_primary_color ?? branding.primaryColor,
    secondaryColor: account?.brand_secondary_color ?? branding.secondaryColor,
    logoUrl: account?.brand_logo_url ?? branding.logoUrl,
    portalDomain: account?.portal_domain ?? branding.portalDomain ?? '',
    onboardingComplete,
  }
}
