import { PortalBillingView } from '@/components/portal/PortalBillingView'
import { assertPortalSectionEnabled } from '@/lib/portal/section-guard'
import { getPortalWorkspace } from '@/lib/portal/queries'
import { requirePortalSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

export default async function PortalBillingPage() {
  const session = await requirePortalSession()
  const workspace = await getPortalWorkspace(session.accountId, session.contactId)
  if (!workspace) return null

  assertPortalSectionEnabled(workspace.config, 'billing')

  return <PortalBillingView />
}
