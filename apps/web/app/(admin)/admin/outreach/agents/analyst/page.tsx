import { PipelineAnalystAgentWorkspace } from '@/components/agents/workspaces/PipelineAnalystAgentWorkspace'
import { getSdrAgentSnapshot } from '@/lib/agents/queries'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function PipelineAnalystPage() {
  const session = await requireAdminSession()
  const [snapshot, sdrConfig] = await Promise.all([
    getSdrAgentSnapshot(session.accountId),
    findSdrConfigByAccount(session.accountId),
  ])

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-secondary)]">Loading pipeline analyst…</div>
      }
    >
      <PipelineAnalystAgentWorkspace
        snapshot={snapshot}
        defaultMinIcpScore={sdrConfig?.defaultMinIcpScore ?? 70}
      />
    </Suspense>
  )
}
