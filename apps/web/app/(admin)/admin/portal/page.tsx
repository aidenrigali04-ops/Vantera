import { AdminPortalPageClient } from '@/components/portal/AdminPortalPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  findPreviewContactId,
  getAdminPortalMeta,
  getPortalWorkspace,
} from '@/lib/portal/queries'

export const dynamic = 'force-dynamic'

export default async function AdminPortalPage() {
  const session = await requireAdminSession()
  const [meta, previewContactId] = await Promise.all([
    getAdminPortalMeta(session.accountId),
    findPreviewContactId(session.accountId),
  ])

  const workspace = previewContactId
    ? await getPortalWorkspace(session.accountId, previewContactId)
    : null

  return <AdminPortalPageClient meta={meta} workspace={workspace} />
}
