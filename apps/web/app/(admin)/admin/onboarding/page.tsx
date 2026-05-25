import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { loadOnboardingWorkspace } from '@/lib/onboarding/load-onboarding-workspace'
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
  const workspace = await loadOnboardingWorkspace(session, branding)

  if (!workspace.accountId) {
    console.error('[admin/onboarding] session missing accountId', {
      userId: session.userId,
      email: session.email,
    })
    redirect('/auth/login?error=workspace_missing')
  }

  if (workspace.onboardingComplete) {
    redirect('/admin/dashboard')
  }

  return (
    <OnboardingWizard
      key={workspace.accountId}
      accountId={workspace.accountId}
      businessName={workspace.businessName}
      currentVertical={workspace.currentVertical}
      initialPrimaryColor={workspace.primaryColor}
      initialSecondaryColor={workspace.secondaryColor}
      initialLogoUrl={workspace.logoUrl}
      initialPortalDomain={workspace.portalDomain}
    />
  )
}
