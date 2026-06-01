import { ContactsPageClient } from '@/app/(admin)/admin/contacts/ContactsPageClient'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { countContactsByType, findContacts, getActiveClientKpis } from '@/lib/db/queries'
import { AlertTriangle, CalendarClock, RefreshCw, Users } from 'lucide-react'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function ActiveClientsPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  const [initialContacts, typeCounts, kpis] = await Promise.all([
    findContacts(session.accountId, { limit: 50, lifecycleStage: 'active_client' }),
    countContactsByType(session.accountId),
    getActiveClientKpis(session.accountId),
  ])

  return (
    <div className="space-y-5">
      <KpiStrip
        items={[
          { label: 'Active clients', value: kpis.activeClients, icon: Users },
          { label: 'Churn risk', value: kpis.churnRisk, icon: AlertTriangle },
          { label: 'Renewals due', value: kpis.renewalsDue, icon: RefreshCw },
          { label: 'Overdue tasks', value: kpis.overdueTasks, icon: CalendarClock },
        ]}
      />
      <ContactsPageClient
        initialContacts={initialContacts}
        session={session}
        vertical={branding.vertical}
        typeCounts={typeCounts}
        basePath="/admin/clients"
      />
    </div>
  )
}
