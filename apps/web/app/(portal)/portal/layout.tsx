import { PortalAppShell } from '@/components/portal/PortalAppShell'
import { requirePortalSession } from '@/lib/auth/require-session'
import { getPortalNavCounts, getPortalWorkspace } from '@/lib/portal/queries'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function PortalSectionLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalSession()
  const workspace = await getPortalWorkspace(session.accountId, session.contactId)

  if (!workspace) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-base)] p-8">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Portal unavailable</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            We couldn&apos;t load your workspace. Please contact your account manager.
          </p>
        </div>
      </div>
    )
  }

  const navCounts = await getPortalNavCounts(session.accountId, session.contactId)

  return (
    <PortalAppShell
      shell={{ workspace, navCounts, preview: false, previewContactId: null }}
      liveRefresh
    >
      {children}
    </PortalAppShell>
  )
}
