import { LeadDetailClient } from '@/app/(admin)/admin/(intelligence)/pipeline/[id]/LeadDetailClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeadActivities, findLeadWithProfile } from '@/lib/leads/queries'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: { id: string }
}

export default async function LeadDetailPage({ params }: Props) {
  const session = await requireAdminSession()
  const row = await findLeadWithProfile(session.accountId, params.id)

  if (!row) {
    notFound()
  }

  const activities = await findLeadActivities(session.accountId, params.id)

  return (
    <LeadDetailClient lead={row.lead} profile={row.profile} activities={activities} />
  )
}
