import { db } from '@/lib/db/client'
import type { SdrAgentCard, SdrAgentSnapshot } from '@/lib/agents/types'
import { SDR_AGENT_DEFINITIONS, buildSdrAgentCards } from '@/lib/agents/sdr-agents'
import {
  aspireSavedSearches,
  leadDrafts,
  leads,
  outreachCampaignEnrollments,
  outreachCampaigns,
  sdrAgentConfigs,
} from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'

export async function getSdrAgentSnapshot(accountId: string): Promise<SdrAgentSnapshot> {
  const [campaignStats] = await db
    .select({
      active: sql<number>`count(*) filter (where ${outreachCampaigns.status} = 'active')::int`,
      draft: sql<number>`count(*) filter (where ${outreachCampaigns.status} = 'draft')::int`,
    })
    .from(outreachCampaigns)
    .where(
      and(eq(outreachCampaigns.accountId, accountId), isNull(outreachCampaigns.deletedAt)),
    )

  const [searchStats] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(aspireSavedSearches)
    .where(
      and(
        eq(aspireSavedSearches.accountId, accountId),
        eq(aspireSavedSearches.isActive, true),
        isNull(aspireSavedSearches.deletedAt),
      ),
    )

  const [draftStats] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(leadDrafts)
    .where(
      and(
        eq(leadDrafts.accountId, accountId),
        eq(leadDrafts.status, 'pending_review'),
        isNull(leadDrafts.deletedAt),
      ),
    )

  const [leadStats] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.accountId, accountId),
        isNull(leads.deletedAt),
        isNull(leads.convertedContactId),
        sql`${leads.relationshipStatus} not in ('won', 'lost')`,
      ),
    )

  const [enrollmentStats] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, accountId),
        eq(outreachCampaignEnrollments.status, 'active'),
      ),
    )

  const [scoutConfig] = await db
    .select({ isActive: sdrAgentConfigs.isActive, isPaused: sdrAgentConfigs.isPaused })
    .from(sdrAgentConfigs)
    .where(
      and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)),
    )
    .limit(1)

  return {
    activeCampaigns: campaignStats?.active ?? 0,
    draftCampaigns: campaignStats?.draft ?? 0,
    activeSavedSearches: searchStats?.active ?? 0,
    pendingDrafts: draftStats?.pending ?? 0,
    leadsInPipeline: leadStats?.open ?? 0,
    enrolledLeads: enrollmentStats?.active ?? 0,
    prospectScoutConfigured: Boolean(scoutConfig),
    prospectScoutActive: Boolean(scoutConfig?.isActive && !scoutConfig?.isPaused),
  }
}

export async function getSdrAgentCards(accountId: string): Promise<SdrAgentCard[]> {
  const snapshot = await getSdrAgentSnapshot(accountId)
  return buildSdrAgentCards(snapshot)
}

export function getSdrAgentDefinitions() {
  return SDR_AGENT_DEFINITIONS
}
