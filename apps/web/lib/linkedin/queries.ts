import { db } from '@/lib/db/client'
import { linkedinAccounts, linkedinCampaigns, linkedinSequenceSteps, linkedinSequences } from '@vantera/db'
import { and, desc, eq, isNull, lte } from 'drizzle-orm'

export async function findLinkedinAccount(accountId: string, userId: string) {
  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function findCampaigns(accountId: string) {
  return db
    .select()
    .from(linkedinCampaigns)
    .where(and(eq(linkedinCampaigns.accountId, accountId), isNull(linkedinCampaigns.deletedAt)))
    .orderBy(desc(linkedinCampaigns.updatedAt))
}

export async function findPendingSteps(accountId: string, limit = 100) {
  return db
    .select()
    .from(linkedinSequenceSteps)
    .where(
      and(
        eq(linkedinSequenceSteps.accountId, accountId),
        eq(linkedinSequenceSteps.status, 'pending'),
        lte(linkedinSequenceSteps.sendAt, new Date()),
      ),
    )
    .orderBy(linkedinSequenceSteps.sendAt)
    .limit(limit)
}

export async function getCampaignStats(accountId: string) {
  const campaigns = await findCampaigns(accountId)
  const sequences = await db
    .select()
    .from(linkedinSequences)
    .where(eq(linkedinSequences.accountId, accountId))

  return {
    activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
    totalSequences: sequences.length,
  }
}
