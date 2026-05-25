import { RecordsPageClient } from '@/app/(admin)/admin/records/RecordsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { findRecordsWithRelations, findUsersForAccount } from '@/lib/db/queries'
import { getFirstStage, getStageDefinitionsForAccount } from '@/lib/records/stage-engine'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const RECORD_TYPE_BY_VERTICAL: Record<string, string> = {
  hvac: 'job',
  landscaping: 'job',
  plumbing: 'job',
  construction: 'project',
  property_mgmt: 'property',
  agency: 'account',
  real_estate: 'transaction',
}

type Props = {
  searchParams: { recordType?: string }
}

export default async function RecordsPage({ searchParams }: Props) {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  const recordType = searchParams.recordType ?? (RECORD_TYPE_BY_VERTICAL[branding.vertical] ?? 'job')

  const [stages, initialRecords, users] = await Promise.all([
    getStageDefinitionsForAccount(session.accountId, recordType),
    findRecordsWithRelations(session.accountId, { recordType, limit: 50 }),
    findUsersForAccount(session.accountId),
  ])

  if (stages.length === 0) {
    await getFirstStage(session.accountId, recordType)
  }

  return (
    <RecordsPageClient
      initialRecords={initialRecords}
      stages={stages}
      users={users}
      recordType={recordType}
      accountId={session.accountId}
    />
  )
}
