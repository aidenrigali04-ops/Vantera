import { requireAdminSession } from '@/lib/auth/require-session'
import { getScoutResultDetail } from '@/lib/sdr/scout-queries'
import { ScoutLeadEnrichmentPage } from '@/components/scout/ScoutLeadEnrichmentPage'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ScoutResultPage({
  params,
}: {
  params: { searchId: string; resultId: string }
}) {
  const session = await requireAdminSession()
  const data = await getScoutResultDetail(session.accountId, params.resultId)
  if (!data) notFound()

  const serialize = (v: unknown): any => JSON.parse(JSON.stringify(v))

  return (
    <ScoutLeadEnrichmentPage
      result={serialize(data.result)}
      lead={serialize(data.lead)}
      profile={serialize(data.profile)}
      searchId={params.searchId}
    />
  )
}
