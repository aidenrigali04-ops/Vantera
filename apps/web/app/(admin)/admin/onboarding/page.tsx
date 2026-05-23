import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from './OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function AdminOnboardingPage() {
  const session = await requireAdminSession()

  if (session.role !== 'owner') {
    redirect('/admin/dashboard')
  }

  const branding = getBrandingFromHeaders(headers())

  // Onboarding's Step 3 hard-deletes stage_definitions — that's safe only
  // before the account has any real records on it. Once the account is past
  // onboarding, bouncing back into the wizard would risk wiping pipeline data,
  // so send completed accounts to the dashboard.
  if (branding.onboardingComplete) {
    redirect('/admin/dashboard')
  }

  return (
    <OnboardingWizard
      accountId={session.accountId}
      businessName={branding.businessName}
      currentVertical={branding.vertical || null}
      initialPrimaryColor={branding.primaryColor}
      initialSecondaryColor={branding.secondaryColor}
      initialLogoUrl={branding.logoUrl}
      initialPortalDomain={branding.portalDomain || ''}
    />
  )
}
