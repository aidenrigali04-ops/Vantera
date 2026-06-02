import { PortalHomeView } from '@/components/portal/PortalHomeView'
import { PortalShell } from '@/components/portal/PortalShell'
import { Button } from '@/components/ui/button'
import type { PortalWorkspace } from '@/lib/portal/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Props = {
  workspace: PortalWorkspace | null
  contactLabel: string | null
  backHref?: string
}

export function AdminPortalPreviewFrame({
  workspace,
  contactLabel,
  backHref = '/admin/portal',
}: Props) {
  return (
    <PortalShell>
      <div className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Admin preview
            </p>
            <p className="truncate text-[13px] text-[var(--text-secondary)]">
              {contactLabel
                ? `Viewing as ${contactLabel} — this is what your client sees`
                : 'Add a client to preview their portal workspace'}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to admin
            </Link>
          </Button>
        </div>
      </div>

      {workspace ? (
        <PortalHomeView workspace={workspace} preview />
      ) : (
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">No client to preview yet</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Create a client and link a project, then return here to see their portal workspace.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/admin/clients">Go to clients</Link>
          </Button>
        </div>
      )}
    </PortalShell>
  )
}
