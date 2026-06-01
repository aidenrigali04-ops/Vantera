import { IntegrationsPageClient } from '@/components/integrations/IntegrationsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findCrmConnections } from '@/lib/integrations/queries'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const session = await requireAdminSession()
  const connections = await findCrmConnections(session.accountId)

  return <IntegrationsPageClient connections={connections} />
}
