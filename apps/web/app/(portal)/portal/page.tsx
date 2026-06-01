import { PortalHomeView } from '@/components/portal/PortalHomeView'
import { requirePortalSession } from '@/lib/auth/require-session'
import { getPortalWorkspace } from '@/lib/portal/queries'

export const dynamic = 'force-dynamic'

export default async function PortalHomePage() {
  const session = await requirePortalSession()
  const workspace = await getPortalWorkspace(session.accountId, session.contactId)

  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf9] p-8">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-stone-900">Portal unavailable</h1>
          <p className="mt-2 text-sm text-stone-500">
            We couldn&apos;t load your workspace. Please contact your account manager.
          </p>
        </div>
      </div>
    )
  }

  return <PortalHomeView workspace={workspace} />
}
