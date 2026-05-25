import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { resolveSessionWorkspace } from '@/lib/onboarding/resolve-session-workspace'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from './OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function AdminOnboardingPage() {
  const session = await requireAdminSession()

  if (session.role !== 'owner') {
    redirect('/admin/dashboard')
  }

  let workspace
  try {
    workspace = await resolveSessionWorkspace(session)
  } catch {
    redirect('/auth/login?error=workspace_missing')
  }

  const branding = getBrandingFromHeaders(headers())

  // Onboarding's Step 3 hard-deletes stage_definitions — that's safe only
  // before the account has any real records on it. Once the account is past
  // onboarding, bouncing back into the wizard would risk wiping pipeline data,
  // so send completed accounts to the dashboard.
  if (branding.onboardingComplete || workspace.account.onboarding_completed_at) {
    redirect('/admin/dashboard')
  }

  return (
    <OnboardingWizard
      accountId={workspace.accountId}
      businessName={workspace.account.name || branding.businessName}
      currentVertical={workspace.account.vertical || branding.vertical || null}
      initialPrimaryColor={workspace.account.brand_primary_color ?? branding.primaryColor}
      initialSecondaryColor={workspace.account.brand_secondary_color ?? branding.secondaryColor}
      initialLogoUrl={workspace.account.brand_logo_url ?? branding.logoUrl}
      initialPortalDomain={workspace.account.portal_domain ?? branding.portalDomain ?? ''}
    />
  )
}
