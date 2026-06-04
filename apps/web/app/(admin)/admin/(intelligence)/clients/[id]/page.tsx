import { ContactProfile } from '@/components/admin/contacts/ContactProfile'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  countOpenRecordsForContact,
  findContact,
  findRecordsForContact,
  findUnifiedContactActivities,
} from '@/lib/db/queries'
import { findContactEmbeddedInsights } from '@/lib/intelligence/queries'
import { getPortalAccessMeta } from '@/lib/portal/invite'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ActiveClientDetailPage({ params }: Props) {
  const session = await requireAdminSession()
  const { id } = await params
  const contact = await findContact(session.accountId, id)

  if (!contact) {
    notFound()
  }

  const [activities, relatedRecords, openRecordsCount, insights, portalMeta] = await Promise.all([
    findUnifiedContactActivities(
      session.accountId,
      id,
      contact.convertedFromLeadId,
      50,
    ),
    findRecordsForContact(session.accountId, id),
    countOpenRecordsForContact(session.accountId, id),
    findContactEmbeddedInsights(session.accountId, id),
    getPortalAccessMeta(session.accountId),
  ])

  return (
    <ContactProfile
      contact={contact}
      activities={activities}
      relatedRecords={relatedRecords}
      openRecordsCount={openRecordsCount}
      insights={insights}
      portal={{
        portalUrl: portalMeta.portalUrl,
        portalLoginUrl: portalMeta.portalLoginUrl,
        portalAccess: contact.portalAccess,
        portalAccountCreatedAt: contact.portalAccountCreatedAt,
        portalInvitedAt: contact.portalInvitedAt,
        portalLastLoginAt: contact.portalLastLoginAt,
        email: contact.email,
      }}
    />
  )
}
