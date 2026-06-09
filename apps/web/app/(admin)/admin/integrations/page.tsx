import { IntegrationsHubClient } from '@/components/integrations/IntegrationsHubClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findCrmConnections } from '@/lib/integrations/queries'
import { getOutreachDomainSettings } from '@/lib/settings/outreach-domain-actions'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const session = await requireAdminSession()
  const [connections, outreachDomain] = await Promise.all([
    findCrmConnections(session.accountId),
    getOutreachDomainSettings(),
  ])

  const domain = outreachDomain.success && outreachDomain.data ? outreachDomain.data : null

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-secondary)]">Loading integrations…</div>
      }
    >
      {domain ? (
        <IntegrationsHubClient connections={connections} outreachDomain={domain} />
      ) : (
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-5 text-sm text-[var(--accent)]">
          <p className="font-medium">Email domain settings could not be loaded</p>
          <p className="mt-1 text-[13px]">
            {!outreachDomain.success
              ? outreachDomain.error
              : 'Refresh the page or contact support if this persists.'}
          </p>
        </div>
      )}
    </Suspense>
  )
}
