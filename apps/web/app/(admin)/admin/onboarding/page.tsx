import { OnboardingWizard } from '@/app/(admin)/admin/onboarding/OnboardingWizard'
import { OnboardingCheckoutReturn } from '@/components/onboarding/OnboardingCheckoutReturn'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { loadOnboardingWorkspace } from '@/lib/onboarding/load-onboarding-workspace'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ checkout?: string; session_id?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const session = await requireAdminSession()
  const params = await searchParams

  if (session.role !== 'owner') {
    redirect('/admin/dashboard')
  }

  if (params.checkout === 'success' && params.session_id) {
    return <OnboardingCheckoutReturn sessionId={params.session_id} />
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
      initialAnalysis={workspace.initialAnalysis}
    />
  )
}
