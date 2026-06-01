import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getOperationalActionFeed } from '@/lib/dashboard/action-feed'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { getDashboardSnapshot } from '@/lib/sample-data/queries'
import { headers } from 'next/headers'
import { DashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  let onboardingIncomplete = false
  if (session.role === 'owner') {
    const brandingMatchesSession =
      !branding.accountId || String(branding.accountId) === String(session.accountId)

    let onboardingComplete = true
    if (brandingMatchesSession && branding.onboardingKnown) {
      onboardingComplete = branding.onboardingComplete
    } else {
      onboardingComplete = await isOnboardingCompleteForAccount(session.accountId)
    }
    onboardingIncomplete = !onboardingComplete
  }

  const [snapshot, actionFeed] = await Promise.all([
    getDashboardSnapshot(session.accountId),
    getOperationalActionFeed(session.accountId),
  ])

  return (
    <DashboardClient
      email={session.email}
      role={session.role}
      businessName={branding.businessName || 'Your workspace'}
      primaryColor={branding.primaryColor || '#1648A0'}
      snapshot={snapshot}
      actionFeed={actionFeed}
      accountId={session.accountId}
      onboardingIncomplete={onboardingIncomplete}
    />
  )
}
