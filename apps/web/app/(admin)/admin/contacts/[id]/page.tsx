import { AIInsightPanel } from '@/components/admin/contacts/AIInsightPanel'
import { ContactProfile } from '@/components/admin/contacts/ContactProfile'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  countOpenRecordsForContact,
  findContact,
  findContactActivities,
  findRecordsForContact,
  findSignalsForContact,
} from '@/lib/db/queries'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: { id: string }
}

export default async function ContactDetailPage({ params }: Props) {
  const session = await requireAdminSession()
  const contact = await findContact(session.accountId, params.id)

  if (!contact) {
    notFound()
  }

  const [activities, relatedRecords, openRecordsCount, signals] = await Promise.all([
    findContactActivities(session.accountId, contact.id, 20),
    findRecordsForContact(session.accountId, contact.id),
    countOpenRecordsForContact(session.accountId, contact.id),
    findSignalsForContact(session.accountId, contact.id),
  ])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <ContactProfile
        contact={contact}
        activities={activities}
        relatedRecords={relatedRecords}
        openRecordsCount={openRecordsCount}
      />
      <AIInsightPanel contact={contact} signals={signals} />
    </div>
  )
}
