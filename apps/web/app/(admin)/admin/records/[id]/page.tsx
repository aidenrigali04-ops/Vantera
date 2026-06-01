import { RecordDetail } from '@/components/admin/records/RecordDetail'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findRecordWithRelations } from '@/lib/db/queries'
import { findRecordEmbeddedInsights } from '@/lib/intelligence/queries'
import { getStageDefinitionsForAccount } from '@/lib/records/stage-engine'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: { id: string }
}

export default async function RecordDetailPage({ params }: Props) {
  const session = await requireAdminSession()
  const record = await findRecordWithRelations(session.accountId, params.id)

  if (!record) {
    notFound()
  }

  const [stages, insights] = await Promise.all([
    getStageDefinitionsForAccount(session.accountId, record.recordType),
    findRecordEmbeddedInsights(session.accountId, params.id),
  ])

  return <RecordDetail record={record} stages={stages} insights={insights} />
}
