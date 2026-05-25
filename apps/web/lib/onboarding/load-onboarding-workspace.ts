import type { AdminSession } from '@/lib/auth/types'
import type { BrandingData } from '@/lib/branding/context'
import type { AccountRow } from './account-store'
import { fetchAccountById } from './account-store'
import { isOnboardingCompleteForAccount } from './completion-status'

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

function brandingMatchesSession(branding: BrandingData, accountId: string): boolean {
  if (!branding.accountId) return true
  return String(branding.accountId) === String(accountId)
}

/**
 * Bootstrap onboarding from the admin session. Completion status always comes
 * from a direct lookup on session.accountId — never from middleware headers
 * alone (host tenant bleed was marking new accounts "complete").
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

  let onboardingComplete = false
  if (accountId) {
    onboardingComplete = await isOnboardingCompleteForAccount(accountId)
  } else if (brandingMatchesSession(branding, accountId) && branding.onboardingKnown) {
    onboardingComplete = branding.onboardingComplete
  }

  const useBranding = brandingMatchesSession(branding, accountId)

  return {
    accountId,
    account,
    businessName: account?.name || (useBranding ? branding.businessName : '') || '',
    currentVertical: account?.vertical || (useBranding ? branding.vertical : '') || null,
    primaryColor: account?.brand_primary_color ?? (useBranding ? branding.primaryColor : '#1648A0'),
    secondaryColor:
      account?.brand_secondary_color ?? (useBranding ? branding.secondaryColor : '#0D9488'),
    logoUrl: account?.brand_logo_url ?? (useBranding ? branding.logoUrl : null),
    portalDomain: account?.portal_domain ?? (useBranding ? branding.portalDomain : '') ?? '',
    onboardingComplete,
  }
}
