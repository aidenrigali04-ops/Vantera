import { OutreachAgentSetupWizardClient } from '@/components/outreach-agent/OutreachAgentSetupWizardClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import { findOutreachAgentConfigByAccount } from '@/lib/outreach-agent/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OutreachAgentSetupPage() {
  const session = await requireAdminSession()

  const [account, existing] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    findOutreachAgentConfigByAccount(session.accountId),
  ])

  if (existing) {
    redirect('/admin/outreach/agents/outreach')
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

  const campaigns = await findOutreachCampaigns(session.accountId)

  return <OutreachAgentSetupWizardClient initialCampaigns={campaigns} />
}
