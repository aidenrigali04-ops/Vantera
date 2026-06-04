import { AdminPortalPageClient } from '@/components/portal/AdminPortalPageClient'
import { PortalDomainSettingsPanel } from '@/components/settings/PortalDomainSettings'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  findPreviewContactId,
  getAdminPortalMeta,
  getPortalWorkspace,
} from '@/lib/portal/queries'
import { getPortalDomainSettings } from '@/lib/settings/portal-domain-actions'

export const dynamic = 'force-dynamic'

export default async function AdminPortalPage() {
  const session = await requireAdminSession()
  const [meta, previewContactId, portalDomain] = await Promise.all([
    getAdminPortalMeta(session.accountId),
    findPreviewContactId(session.accountId),
    getPortalDomainSettings(),
  ])

  const workspace = previewContactId
    ? await getPortalWorkspace(session.accountId, previewContactId)
    : null

  return (
    <div className="space-y-6">
      <AdminPortalPageClient meta={meta} workspace={workspace} />
      <div id="portal-domain">
        {portalDomain.success && portalDomain.data ? (
          <PortalDomainSettingsPanel initial={portalDomain.data} />
        ) : (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-medium">Portal domain settings could not be loaded</p>
            <p className="mt-1 text-[13px]">
              {!portalDomain.success
                ? portalDomain.error
                : 'Run database migration 0027_portal_custom_domain.sql, then refresh.'}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
