import { db } from '@/lib/db/client'
import type { SdrAgentCard, SdrAgentSnapshot } from '@/lib/agents/types'
import { SDR_AGENT_DEFINITIONS, buildSdrAgentCards } from '@/lib/agents/sdr-agents'
import {
  isAutoScoutCampaignWorkflow,
  parseCampaignWorkflow,
} from '@/lib/outreach/types'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import {
  aspireSavedSearches,
  leadDrafts,
  leads,
  outreachAgentConfigs,
  outreachCampaignEnrollments,
  outreachCampaignSteps,
  outreachCampaigns,
  sdrAgentConfigs,
  sdrSequenceSteps,
} from '@vantera/db'
import { normalizeLinkedCampaignIds } from '@/lib/outreach-agent/validate'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

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

  const [emailDraftStats] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(leadDrafts)
    .where(
      and(
        eq(leadDrafts.accountId, accountId),
        eq(leadDrafts.status, 'pending_review'),
        inArray(leadDrafts.channel, ['email', 'sms']),
        isNull(leadDrafts.deletedAt),
      ),
    )

  const [campaignLinkedInStats] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(outreachCampaignSteps)
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        eq(outreachCampaignSteps.channel, 'linkedin'),
        eq(outreachCampaignSteps.status, 'pending'),
        sql`${outreachCampaignSteps.metadata}->>'manualSend' = 'true'`,
      ),
    )

  const [sdrLinkedInStats] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.accountId, accountId),
        eq(sdrSequenceSteps.channel, 'linkedin'),
        eq(sdrSequenceSteps.status, 'scheduled'),
        isNull(sdrSequenceSteps.deletedAt),
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

  const [outreachConfig] = await db
    .select({
      isActive: outreachAgentConfigs.isActive,
      isPaused: outreachAgentConfigs.isPaused,
      linkedCampaignIds: outreachAgentConfigs.linkedCampaignIds,
    })
    .from(outreachAgentConfigs)
    .where(
      and(eq(outreachAgentConfigs.accountId, accountId), isNull(outreachAgentConfigs.deletedAt)),
    )
    .limit(1)

  const linkedCampaignIds = normalizeLinkedCampaignIds(outreachConfig?.linkedCampaignIds)
  let linkedActiveCampaigns = 0
  if (linkedCampaignIds.length > 0) {
    const [linkedActive] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outreachCampaigns)
      .where(
        and(
          eq(outreachCampaigns.accountId, accountId),
          inArray(outreachCampaigns.id, linkedCampaignIds),
          eq(outreachCampaigns.status, 'active'),
          isNull(outreachCampaigns.deletedAt),
        ),
      )
    linkedActiveCampaigns = linkedActive?.count ?? 0
  }

  const automaticOutreach = await isAccountAutomaticOutreach(accountId)
  let autoScoutActiveCampaigns = 0
  if (automaticOutreach) {
    const activeRows = await db
      .select({ workflow: outreachCampaigns.workflow })
      .from(outreachCampaigns)
      .where(
        and(
          eq(outreachCampaigns.accountId, accountId),
          eq(outreachCampaigns.status, 'active'),
          isNull(outreachCampaigns.deletedAt),
        ),
      )
    autoScoutActiveCampaigns = activeRows.filter((row) =>
      isAutoScoutCampaignWorkflow(parseCampaignWorkflow(row.workflow)),
    ).length
  }

  const pendingEmailDrafts = emailDraftStats?.pending ?? 0
  const pendingLinkedInDrafts =
    (campaignLinkedInStats?.pending ?? 0) + (sdrLinkedInStats?.pending ?? 0)

  return {
    activeCampaigns: campaignStats?.active ?? 0,
    draftCampaigns: campaignStats?.draft ?? 0,
    activeSavedSearches: searchStats?.active ?? 0,
    pendingDrafts: pendingEmailDrafts + pendingLinkedInDrafts,
    pendingEmailDrafts,
    pendingLinkedInDrafts,
    leadsInPipeline: leadStats?.open ?? 0,
    enrolledLeads: enrollmentStats?.active ?? 0,
    prospectScoutConfigured: Boolean(scoutConfig),
    prospectScoutActive: Boolean(scoutConfig?.isActive && !scoutConfig?.isPaused),
    outreachAgentConfigured: automaticOutreach
      ? Boolean(scoutConfig)
      : Boolean(outreachConfig && linkedCampaignIds.length > 0),
    outreachAgentActive: automaticOutreach
      ? Boolean(scoutConfig?.isActive && !scoutConfig?.isPaused)
      : Boolean(
          outreachConfig?.isActive &&
            !outreachConfig?.isPaused &&
            linkedCampaignIds.length > 0,
        ),
    linkedActiveCampaigns,
    automaticOutreach,
    autoScoutActiveCampaigns,
  }
}

export async function getSdrAgentCards(accountId: string): Promise<SdrAgentCard[]> {
  const snapshot = await getSdrAgentSnapshot(accountId)
  return buildSdrAgentCards(snapshot)
}

export function getSdrAgentDefinitions() {
  return SDR_AGENT_DEFINITIONS
}
