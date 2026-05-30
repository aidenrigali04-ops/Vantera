import { ContactProfile } from '@/components/admin/contacts/ContactProfile'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  countOpenRecordsForContact,
  findContact,
  findRecordsForContact,
  findUnifiedContactActivities,
} from '@/lib/db/queries'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: { id: string }
}

export default async function CrmClientDetailPage({ params }: Props) {
  const session = await requireAdminSession()
  const contact = await findContact(session.accountId, params.id)

  if (!contact) {
    notFound()
  }

  const [activities, relatedRecords, openRecordsCount] = await Promise.all([
    findUnifiedContactActivities(
      session.accountId,
      params.id,
      contact.convertedFromLeadId,
      50,
    ),
    findRecordsForContact(session.accountId, params.id),
    countOpenRecordsForContact(session.accountId, params.id),
  ])

  return (
    <ContactProfile
      contact={contact}
      activities={activities}
      relatedRecords={relatedRecords}
      openRecordsCount={openRecordsCount}
    />
  )
}
