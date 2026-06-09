import { ClientDetailPage } from '@/components/leads/ClientDetailPage'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeadWithProfile } from '@/lib/leads/queries'
import { db } from '@/lib/db/client'
import { leadDrafts, sdrSequences, sdrSequenceSteps, activities } from '@vantera/db'
import { and, eq, isNull, desc, or } from 'drizzle-orm'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdminSession()

  const leadWithProfile = await findLeadWithProfile(session.accountId, params.id)
  if (!leadWithProfile) notFound()

  const [drafts, sequences, recentSteps, recentActivity] = await Promise.all([
    db
      .select()
      .from(leadDrafts)
      .where(
        and(
          eq(leadDrafts.accountId, session.accountId),
          eq(leadDrafts.leadId, params.id),
          isNull(leadDrafts.deletedAt),
          or(
            eq(leadDrafts.status, 'pending_review'),
            eq(leadDrafts.status, 'approved'),
          ),
        ),
      )
      .orderBy(desc(leadDrafts.createdAt))
      .limit(6),
    db
      .select()
      .from(sdrSequences)
      .where(
        and(
          eq(sdrSequences.accountId, session.accountId),
          eq(sdrSequences.leadId, params.id),
          isNull(sdrSequences.deletedAt),
        ),
      )
      .orderBy(desc(sdrSequences.createdAt))
      .limit(1),
    db
      .select()
      .from(sdrSequenceSteps)
      .where(
        and(
          eq(sdrSequenceSteps.accountId, session.accountId),
          eq(sdrSequenceSteps.leadId, params.id),
          isNull(sdrSequenceSteps.deletedAt),
        ),
      )
      .orderBy(desc(sdrSequenceSteps.createdAt))
      .limit(10),
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.accountId, session.accountId),
          eq(activities.leadId, params.id),
        ),
      )
      .orderBy(desc(activities.createdAt))
      .limit(20),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialize = (v: unknown): any => JSON.parse(JSON.stringify(v))

  return (
    <ClientDetailPage
      lead={serialize(leadWithProfile.lead)}
      profile={serialize(leadWithProfile.profile)}
      drafts={serialize(drafts)}
      sequence={serialize(sequences[0] ?? null)}
      steps={serialize(recentSteps)}
      activity={serialize(recentActivity)}
    />
  )
}
