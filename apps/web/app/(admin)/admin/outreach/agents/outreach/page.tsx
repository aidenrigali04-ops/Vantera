import { OutreachAgentCommandCenterClient } from '@/components/outreach-agent/OutreachAgentCommandCenterClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import {
  findOutreachAgentConfigByAccount,
  getLinkedCampaignSummaries,
  getManualStepsForLinkedCampaigns,
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

  if (!config) {
    redirect('/admin/outreach/agents/outreach/setup')
  }

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!sdrEnabled) {
    redirect('/admin/outreach/agents/setup')
  }

  const [stats, linkedCampaigns, allCampaigns, upcoming, manualSteps] = await Promise.all([
    getOutreachAgentDashboardStats(session.accountId, config.linkedCampaignIds),
    getLinkedCampaignSummaries(session.accountId, config.linkedCampaignIds),
    findOutreachCampaigns(session.accountId),
    getUpcomingStepsForLinkedCampaigns(session.accountId, config.linkedCampaignIds),
    getManualStepsForLinkedCampaigns(session.accountId, config.linkedCampaignIds),
  ])

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading outreach agent…</div>}>
      <OutreachAgentCommandCenterClient
        config={config}
        stats={stats}
        linkedCampaigns={linkedCampaigns}
        allCampaigns={allCampaigns}
        upcoming={upcoming}
        manualSteps={manualSteps}
      />
    </Suspense>
  )
}
