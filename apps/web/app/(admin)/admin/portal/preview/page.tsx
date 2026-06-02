import { AdminPortalPreviewFrame } from '@/components/portal/AdminPortalPreviewFrame'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findContact } from '@/lib/db/queries'
import { findPreviewContactId, getPortalWorkspace } from '@/lib/portal/queries'
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
      backHref={backHref}
    />
  )
}
