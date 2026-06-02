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
  params: { id: string }
}

export default async function ActiveClientDetailPage({ params }: Props) {
  const session = await requireAdminSession()
  const contact = await findContact(session.accountId, params.id)

  if (!contact) {
    notFound()
  }

  const [activities, relatedRecords, openRecordsCount, insights, portalMeta] = await Promise.all([
    findUnifiedContactActivities(
      session.accountId,
      params.id,
      contact.convertedFromLeadId,
      50,
    ),
    findRecordsForContact(session.accountId, params.id),
    countOpenRecordsForContact(session.accountId, params.id),
    findContactEmbeddedInsights(session.accountId, params.id),
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
        portalInvitedAt: contact.portalInvitedAt,
        portalLastLoginAt: contact.portalLastLoginAt,
        email: contact.email,
      }}
    />
  )
}
