import { OnboardingWizard } from '@/app/(admin)/admin/onboarding/OnboardingWizard'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { loadOnboardingWorkspace } from '@/lib/onboarding/load-onboarding-workspace'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await requireAdminSession()

  if (session.role !== 'owner') {
    redirect('/admin/dashboard')
  }

  const branding = getBrandingFromHeaders(headers())
  const workspace = await loadOnboardingWorkspace(session, branding)

  if (workspace.onboardingComplete) {
    redirect('/admin/dashboard')
  }

  if (!workspace.accountId) {
    redirect('/admin/dashboard')
  }

  return (
    <OnboardingWizard
      accountId={workspace.accountId}
      businessName={workspace.businessName}
      websiteUrl={workspace.websiteUrl}
      currentVertical={workspace.currentVertical}
    />
  )
}
