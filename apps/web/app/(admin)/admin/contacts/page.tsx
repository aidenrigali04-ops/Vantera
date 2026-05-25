import { ContactsPageClient } from '@/app/(admin)/admin/contacts/ContactsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { countContactsByType, findContacts } from '@/lib/db/queries'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  const [initialContacts, typeCounts] = await Promise.all([
    findContacts(session.accountId, { limit: 50 }),
    countContactsByType(session.accountId),
  ])

  return (
    <ContactsPageClient
      initialContacts={initialContacts}
      session={session}
      vertical={branding.vertical}
      typeCounts={typeCounts}
    />
  )
}
