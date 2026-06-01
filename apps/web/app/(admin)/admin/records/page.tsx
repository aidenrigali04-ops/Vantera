import { RecordsPageClient } from '@/app/(admin)/admin/records/RecordsPageClient'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  findRecordsWithRelations,
  findUsersForAccount,
  getProjectKpis,
} from '@/lib/db/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { getStageDefinitionsForAccount } from '@/lib/records/stage-engine'
import { formatUsdFromCents } from '@/lib/contacts/format'
import { AlertTriangle, CheckCircle2, CircleDollarSign, FolderKanban } from 'lucide-react'

export const dynamic = 'force-dynamic'

const RECORD_TYPE = 'project'

export default async function RecordsPage() {
  const session = await requireAdminSession()

  const onboardingComplete =
    session.role === 'owner'
      ? await isOnboardingCompleteForAccount(session.accountId)
      : true

  const [initialRecords, stages, users, kpis] = await Promise.all([
    findRecordsWithRelations(session.accountId, { recordType: RECORD_TYPE, limit: 200 }),
    getStageDefinitionsForAccount(session.accountId, RECORD_TYPE),
    findUsersForAccount(session.accountId),
    getProjectKpis(session.accountId, RECORD_TYPE),
  ])

  return (
    <RecordsPageClient
      initialRecords={initialRecords}
      stages={stages}
      users={users}
      recordType={RECORD_TYPE}
      accountId={session.accountId}
      setupMode={session.role === 'owner' && !onboardingComplete}
      kpiStrip={
        <KpiStrip
          items={[
            { label: 'Active', value: kpis.active, icon: FolderKanban },
            { label: 'Overdue', value: kpis.overdue, icon: AlertTriangle },
            { label: 'Completed', value: kpis.completed, icon: CheckCircle2 },
            {
              label: 'Active value',
              value: formatUsdFromCents(kpis.activeValueCents),
              icon: CircleDollarSign,
            },
          ]}
        />
      }
    />
  )
}
