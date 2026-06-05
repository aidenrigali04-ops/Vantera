import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getOperationalActionFeed, type ActionFeedItem } from '@/lib/dashboard/action-feed'
import { getSdrAgentCards } from '@/lib/agents/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'

export const dynamic = 'force-dynamic'

/** Strip Date objects so RSC → client serialization stays safe. */
function serializeActionFeed(items: ActionFeedItem[]): ActionFeedItem[] {
  return items.map((item) => ({
    ...item,
    createdAt: new Date(item.createdAt).toISOString() as unknown as Date,
  }))
}

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

  if (onboardingIncomplete) {
    redirect(AUTH_ONBOARDING_PATH)
  }

  const [actionFeed, sdrAgents] = await Promise.all([
    getOperationalActionFeed(session.accountId),
    getSdrAgentCards(session.accountId),
  ])

  return (
    <DashboardClient
      email={session.email}
      actionFeed={serializeActionFeed(actionFeed)}
      accountId={session.accountId}
      onboardingIncomplete={onboardingIncomplete}
      sdrAgents={sdrAgents}
    />
  )
}
