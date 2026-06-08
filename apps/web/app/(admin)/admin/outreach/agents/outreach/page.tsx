import { OutreachAgentWorkspace } from '@/components/agents/workspaces/OutreachAgentWorkspace'
import { serializeForClient } from '@/lib/agents/serialize'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import { getOutreachAgentActivityFeed } from '@/lib/outreach-agent/activity-queries'
import {
  findOutreachAgentConfigByAccount,
  getLinkedCampaignSummaries,
  getOutreachAgentDashboardStats,
  getUpcomingStepsForLinkedCampaigns,
} from '@/lib/outreach-agent/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function OutreachAgentPage() {
  const session = await requireAdminSession()

  const [account, config] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    findOutreachAgentConfigByAccount(session.accountId),
  ])

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!sdrEnabled) {
    redirect('/admin/outreach/agents/setup')
  }

  const allCampaigns = await findOutreachCampaigns(session.accountId)

  if (!config) {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading…</div>}>
        <OutreachAgentWorkspace
          mode="setup"
          config={null}
          stats={null}
          linkedCampaigns={[]}
          allCampaigns={serializeForClient(allCampaigns)}
          upcoming={[]}
          initialActivity={[]}
          accountId={session.accountId}
        />
      </Suspense>
    )
  }

  const [stats, linkedCampaigns, upcoming, activity] = await Promise.all([
    getOutreachAgentDashboardStats(session.accountId, config.linkedCampaignIds),
    getLinkedCampaignSummaries(session.accountId, config.linkedCampaignIds),
    getUpcomingStepsForLinkedCampaigns(session.accountId, config.linkedCampaignIds),
    getOutreachAgentActivityFeed(session.accountId),
  ])

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading outreach agent…</div>}>
      <OutreachAgentWorkspace
        mode="configured"
        config={serializeForClient(config)}
        stats={stats}
        linkedCampaigns={serializeForClient(linkedCampaigns)}
        allCampaigns={serializeForClient(allCampaigns)}
        upcoming={upcoming.map((row) => ({
          ...row,
          step: {
            ...row.step,
            sendAt:
              row.step.sendAt instanceof Date
                ? row.step.sendAt.toISOString()
                : String(row.step.sendAt),
          },
        }))}
        initialActivity={activity}
        accountId={session.accountId}
      />
    </Suspense>
  )
}
