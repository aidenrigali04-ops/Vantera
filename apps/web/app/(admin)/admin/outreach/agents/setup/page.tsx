import { SdrSetupWizardClient } from '@/components/sdr/SdrSetupWizardClient'
import { PageHeader } from '@/components/operational/PageHeader'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SdrSetupPage() {
  const session = await requireAdminSession()

  const [account] = await db
    .select({ plan: accounts.plan, vertical: accounts.vertical, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  const enabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!enabled) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold">SDR Agents — Enterprise</h1>
        <p className="mt-2 text-sm text-stone-600">
          Deploy a 24/7 sales development rep inside your account. Contact your admin to enable
          the SDR Agent module.
        </p>
      </div>
    )
  }

  const existing = await findSdrConfigByAccount(session.accountId)
  if (existing) {
    redirect('/admin/outreach/agents')
  }

  return (
    <div className="space-y-8 py-4">
      <PageHeader
        title="Set up your SDR Agent"
        description="Configure identity, ICP, and schedule — launch in about 5 minutes."
      />
      <SdrSetupWizardClient
        accountVertical={account?.vertical ?? 'agency'}
        accountName={account?.name ?? 'Your business'}
      />
    </div>
  )
}
