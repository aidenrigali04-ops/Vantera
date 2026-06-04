import { ContactsPageClient } from '@/app/(admin)/admin/contacts/ContactsPageClient'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { requireAdminSession } from '@/lib/auth/require-session'
import { countContactsByType, findContacts, getActiveClientKpis } from '@/lib/db/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { AlertTriangle, CalendarClock, RefreshCw, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CrmActiveClientsPage() {
  const session = await requireAdminSession()

  const onboardingComplete =
    session.role === 'owner'
      ? await isOnboardingCompleteForAccount(session.accountId)
      : true

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
        className="lg:grid-cols-4"
      />
      <ContactsPageClient
        initialContacts={initialContacts}
        session={session}
        typeCounts={typeCounts}
        basePath="/admin/crm/clients"
        setupMode={session.role === 'owner' && !onboardingComplete}
      />
    </div>
  )
}
