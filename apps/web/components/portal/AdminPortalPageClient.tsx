'use client'

import { PortalHomeView } from '@/components/portal/PortalHomeView'
import { PageHeader } from '@/components/operational/PageHeader'
import { Button } from '@/components/ui/button'
import type { AdminPortalMeta, PortalWorkspace } from '@/lib/portal/types'
import { adminPortalPreviewPath } from '@/lib/portal/url'
import { Copy, ExternalLink, Eye } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Props = {
  meta: AdminPortalMeta
  workspace: PortalWorkspace | null
}

export function AdminPortalPageClient({ meta, workspace }: Props) {
  async function copyPortalUrl() {
    await navigator.clipboard.writeText(meta.portalLoginUrl)
    toast.success('Client login URL copied')
  }

  return (
    <div className="space-y-5" data-tour="nav-portal">
      <PageHeader
        title="Client Portal"
        description="What your clients see — project progress, deliverables, approvals, and billing in one premium workspace."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={adminPortalPreviewPath()} target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Preview client portal
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900">Portal access</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Send portal invites from any client profile. Clients sign in with branded auth and
              see projects, documents, invoices, and messaging.
            </p>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div>
                <dt className="text-stone-500">Client login URL</dt>
                <dd className="mt-0.5 break-all font-medium text-stone-900">{meta.portalLoginUrl}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Clients with access</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{meta.portalEnabledCount}</dd>
              </div>
              {meta.previewContactName ? (
                <div>
                  <dt className="text-stone-500">Preview as</dt>
                  <dd className="mt-0.5 font-medium text-stone-900">{meta.previewContactName}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/portal#portal-domain">Portal domain</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={adminPortalPreviewPath()}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview portal
                </Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void copyPortalUrl()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy login URL
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={meta.portalLoginUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open client login
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/clients">Manage clients</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 p-5">
            <h3 className="text-sm font-semibold text-stone-900">What clients get</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-stone-600">
              <li>Secure branded sign-in for each client</li>
              <li>Project progress with stage tracking</li>
              <li>Shared documents and signature requests</li>
              <li>Invoices with one-click payment links</li>
              <li>Two-way portal messaging with your team</li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
                Client preview
              </p>
              <Button size="sm" variant="ghost" className="h-8" asChild>
                <Link href={adminPortalPreviewPath()}>
                  Full screen preview
                </Link>
              </Button>
            </div>
            {workspace ? (
              <PortalHomeView workspace={workspace} preview />
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-stone-800">No preview available yet</p>
                <p className="mt-1 text-sm text-stone-500">
                  Add a client and project to see how the portal will look.
                </p>
                <Button className="mt-4 bg-stone-900 hover:bg-stone-800" asChild>
                  <Link href="/admin/clients">Add a client</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
