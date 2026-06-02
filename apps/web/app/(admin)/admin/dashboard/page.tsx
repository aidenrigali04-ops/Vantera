import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getOperationalActionFeed, type ActionFeedItem } from '@/lib/dashboard/action-feed'
import { getVentoraDashboardPayload } from '@/lib/dashboard/ventora-data'
import { getSdrAgentCards } from '@/lib/agents/queries'
import { findAccountEmbeddedInsights } from '@/lib/intelligence/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { getDashboardSnapshot } from '@/lib/sample-data/queries'
import { headers } from 'next/headers'
import { DashboardClient } from './dashboard-client'

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

  const [snapshot, actionFeed, embeddedInsights, sdrAgents] = await Promise.all([
    getDashboardSnapshot(session.accountId),
    getOperationalActionFeed(session.accountId),
    findAccountEmbeddedInsights(session.accountId, 4),
    getSdrAgentCards(session.accountId),
  ])

  const ventora = await getVentoraDashboardPayload(
    session.accountId,
    snapshot,
    embeddedInsights,
  )

  return (
    <DashboardClient
      email={session.email}
      ventora={ventora}
      actionFeed={serializeActionFeed(actionFeed)}
      accountId={session.accountId}
      onboardingIncomplete={onboardingIncomplete}
      isEmpty={snapshot.isEmpty}
      sdrAgents={sdrAgents}
    />
  )
}
