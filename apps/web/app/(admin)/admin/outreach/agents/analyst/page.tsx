import { PipelineAnalystAgentWorkspace } from '@/components/agents/workspaces/PipelineAnalystAgentWorkspace'
import { getSdrAgentSnapshot } from '@/lib/agents/queries'
import { requireAdminSession } from '@/lib/auth/require-session'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function PipelineAnalystPage() {
  const session = await requireAdminSession()
  const snapshot = await getSdrAgentSnapshot(session.accountId)

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-secondary)]">Loading pipeline analyst…</div>
      }
    >
      <PipelineAnalystAgentWorkspace snapshot={snapshot} />
    </Suspense>
  )
}
