import { AdminPortalPreviewFrame } from '@/components/portal/AdminPortalPreviewFrame'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findContact } from '@/lib/db/queries'
import {
  findPreviewContactId,
  getPortalNavCounts,
  getPortalWorkspace,
} from '@/lib/portal/queries'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: { contact?: string; from?: string }
}

export default async function AdminPortalPreviewPage({ searchParams }: Props) {
  const session = await requireAdminSession()
  const requestedContactId = searchParams.contact?.trim()
  let contactId = requestedContactId ?? null

  if (contactId) {
    const contact = await findContact(session.accountId, contactId)
    if (!contact) {
      notFound()
    }
  } else {
    contactId = await findPreviewContactId(session.accountId)
  }

  const workspace = contactId
    ? await getPortalWorkspace(session.accountId, contactId)
    : null

  const navCounts = contactId
    ? await getPortalNavCounts(session.accountId, contactId)
    : {
        projects: 0,
        messages: 0,
        unreadMessages: 0,
        openInvoices: 0,
        pendingApprovals: 0,
        documents: 0,
        activities: 0,
      }

  const contactLabel = workspace
    ? `${workspace.contactFirstName} ${workspace.contactLastName}`.trim()
    : null

  const backHref =
    searchParams.from === 'client' && contactId
      ? `/admin/clients/${contactId}`
      : '/admin/portal'

  return (
    <AdminPortalPreviewFrame
      workspace={workspace}
      contactLabel={contactLabel}
      contactId={contactId}
      navCounts={navCounts}
      backHref={backHref}
    />
  )
}
