import { requireAdminSession } from '@/lib/auth/require-session'
import { getScoutRunResults } from '@/lib/sdr/scout-queries'
import { ScoutRunDetailPage } from '@/components/scout/ScoutRunDetailPage'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ScoutRunPage({ params }: { params: { searchId: string } }) {
  const session = await requireAdminSession()
  const data = await getScoutRunResults(session.accountId, params.searchId)
  if (!data) notFound()

  const serialize = (v: unknown): any => JSON.parse(JSON.stringify(v))

  return <ScoutRunDetailPage search={serialize(data.search)} results={serialize(data.results)} />
}
