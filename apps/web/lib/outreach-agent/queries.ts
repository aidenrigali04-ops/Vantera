import { db } from '@/lib/db/client'
import {
  findOutreachCampaignById,
  findOutreachCampaigns,
} from '@/lib/outreach/queries'
import {
  parseCampaignMetrics,
  type CampaignWithStats,
} from '@/lib/outreach/types'
import type {
  OutreachAgentConfig,
  OutreachAgentDashboardStats,
  OutreachAgentUpcomingStep,
} from '@/lib/outreach-agent/types'
import { normalizeLinkedCampaignIds } from '@/lib/outreach-agent/validate'
import {
  leads,
  outreachAgentConfigs,
  outreachCampaignEnrollments,
  outreachCampaignSteps,
  outreachCampaigns,
} from '@vantera/db'
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'

export function mapOutreachAgentConfigRow(
  row: typeof outreachAgentConfigs.$inferSelect,
): OutreachAgentConfig {
  return {
    id: row.id,
    accountId: row.accountId,
    agentName: row.agentName,
    linkedCampaignIds: normalizeLinkedCampaignIds(row.linkedCampaignIds),
    isActive: row.isActive,
    isPaused: row.isPaused,
    pausedReason: row.pausedReason,
  }
}

export async function findOutreachAgentConfigByAccount(
  accountId: string,
): Promise<OutreachAgentConfig | null> {
  const [row] = await db
    .select()
    .from(outreachAgentConfigs)
    .where(
      and(eq(outreachAgentConfigs.accountId, accountId), isNull(outreachAgentConfigs.deletedAt)),
    )
    .limit(1)

  return row ? mapOutreachAgentConfigRow(row) : null
}

export async function getLinkedCampaignSummaries(
  accountId: string,
  linkedCampaignIds: string[],
): Promise<CampaignWithStats[]> {
  if (linkedCampaignIds.length === 0) return []

  const campaigns = await findOutreachCampaigns(accountId)
  const linked = new Set(linkedCampaignIds)
  return campaigns.filter((campaign) => linked.has(campaign.id))
}

export async function assertCampaignsBelongToAccount(
  accountId: string,
  campaignIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (campaignIds.length === 0) {
    return { ok: false, error: 'Select at least one campaign' }
  }

  const rows = await db
    .select({ id: outreachCampaigns.id })
    .from(outreachCampaigns)
    .where(
      and(
        eq(outreachCampaigns.accountId, accountId),
        inArray(outreachCampaigns.id, campaignIds),
        isNull(outreachCampaigns.deletedAt),
      ),
    )

  if (rows.length !== campaignIds.length) {
    return { ok: false, error: 'One or more campaigns could not be found' }
  }

  return { ok: true }
}

export async function getOutreachAgentDashboardStats(
  accountId: string,
  linkedCampaignIds: string[],
): Promise<OutreachAgentDashboardStats> {
  if (linkedCampaignIds.length === 0) {
    return {
      linkedCampaigns: 0,
      activeCampaigns: 0,
      enrolledLeads: 0,
      sentToday: 0,
      repliesThisWeek: 0,
      pendingManualSteps: 0,
    }
  }

  const campaigns = await getLinkedCampaignSummaries(accountId, linkedCampaignIds)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length

  const [enrollmentStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, accountId),
        inArray(outreachCampaignEnrollments.campaignId, linkedCampaignIds),
        eq(outreachCampaignEnrollments.status, 'active'),
      ),
    )

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [sentTodayStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outreachCampaignSteps)
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        inArray(outreachCampaignSteps.campaignId, linkedCampaignIds),
        eq(outreachCampaignSteps.status, 'sent'),
        gte(outreachCampaignSteps.sentAt, startOfDay),
      ),
    )

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [replyStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, accountId),
        inArray(outreachCampaignEnrollments.campaignId, linkedCampaignIds),
        sql`${outreachCampaignEnrollments.repliedAt} is not null`,
        gte(outreachCampaignEnrollments.repliedAt, weekAgo),
      ),
    )

  const [manualStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outreachCampaignSteps)
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        inArray(outreachCampaignSteps.campaignId, linkedCampaignIds),
        eq(outreachCampaignSteps.status, 'pending'),
        sql`${outreachCampaignSteps.metadata}->>'manualSend' = 'true'`,
      ),
    )

  return {
    linkedCampaigns: linkedCampaignIds.length,
    activeCampaigns,
    enrolledLeads: enrollmentStats?.count ?? 0,
    sentToday: sentTodayStats?.count ?? 0,
    repliesThisWeek: replyStats?.count ?? 0,
    pendingManualSteps: manualStats?.count ?? 0,
  }
}

export async function getUpcomingStepsForLinkedCampaigns(
  accountId: string,
  linkedCampaignIds: string[],
  limit = 12,
): Promise<OutreachAgentUpcomingStep[]> {
  if (linkedCampaignIds.length === 0) return []

  const rows = await db
    .select({
      step: outreachCampaignSteps,
      lead: leads,
      campaign: outreachCampaigns,
    })
    .from(outreachCampaignSteps)
    .innerJoin(leads, eq(leads.id, outreachCampaignSteps.leadId))
    .innerJoin(outreachCampaigns, eq(outreachCampaigns.id, outreachCampaignSteps.campaignId))
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        inArray(outreachCampaignSteps.campaignId, linkedCampaignIds),
        eq(outreachCampaignSteps.status, 'pending'),
        lte(outreachCampaignSteps.sendAt, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        sql`COALESCE(${outreachCampaignSteps.metadata}->>'manualSend', 'false') <> 'true'`,
        isNull(outreachCampaigns.deletedAt),
      ),
    )
    .orderBy(asc(outreachCampaignSteps.sendAt))
    .limit(limit)

  return rows.map((row) => ({
    step: {
      id: row.step.id,
      stepIndex: row.step.stepIndex,
      channel: row.step.channel,
      sendAt: row.step.sendAt,
      campaignId: row.step.campaignId,
    },
    campaignName: row.campaign.name,
    firstName: row.lead.firstName,
    lastName: row.lead.lastName,
    company: row.lead.company,
  }))
}

export async function getManualStepsForLinkedCampaigns(
  accountId: string,
  linkedCampaignIds: string[],
  limit = 20,
): Promise<OutreachAgentUpcomingStep[]> {
  if (linkedCampaignIds.length === 0) return []

  const rows = await db
    .select({
      step: outreachCampaignSteps,
      lead: leads,
      campaign: outreachCampaigns,
    })
    .from(outreachCampaignSteps)
    .innerJoin(leads, eq(leads.id, outreachCampaignSteps.leadId))
    .innerJoin(outreachCampaigns, eq(outreachCampaigns.id, outreachCampaignSteps.campaignId))
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        inArray(outreachCampaignSteps.campaignId, linkedCampaignIds),
        eq(outreachCampaignSteps.status, 'pending'),
        sql`${outreachCampaignSteps.metadata}->>'manualSend' = 'true'`,
        isNull(outreachCampaigns.deletedAt),
      ),
    )
    .orderBy(asc(outreachCampaignSteps.sendAt))
    .limit(limit)

  return rows.map((row) => ({
    step: {
      id: row.step.id,
      stepIndex: row.step.stepIndex,
      channel: row.step.channel,
      sendAt: row.step.sendAt,
      campaignId: row.step.campaignId,
    },
    campaignName: row.campaign.name,
    firstName: row.lead.firstName,
    lastName: row.lead.lastName,
    company: row.lead.company,
  }))
}

export async function findLinkedCampaignById(
  accountId: string,
  config: OutreachAgentConfig,
  campaignId: string,
): Promise<CampaignWithStats | null> {
  if (!config.linkedCampaignIds.includes(campaignId)) return null
  return findOutreachCampaignById(accountId, campaignId)
}

export function aggregateLinkedCampaignMetrics(campaigns: CampaignWithStats[]) {
  return campaigns.reduce(
    (acc, campaign) => {
      const metrics = parseCampaignMetrics(campaign.metrics)
      acc.enrolled += metrics.enrolled
      acc.sent += metrics.sent
      acc.replied += metrics.replied
      acc.meetings += metrics.meetings
      return acc
    },
    { enrolled: 0, sent: 0, replied: 0, meetings: 0 },
  )
}
