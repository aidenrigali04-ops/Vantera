import { buildMonthlyOverview, currentMonthAbbrev } from '@/lib/dashboard/chart-data'
import type {
  VentoraCampaignGroup,
  VentoraCampaignRow,
  VentoraDashboardPayload,
} from '@/lib/dashboard/ventora-types'
import type { EmbeddedInsight } from '@/lib/intelligence/types'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import type { CampaignWithStats } from '@/lib/outreach/types'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { db } from '@/lib/db/client'
import { leads } from '@vantera/db'
import { and, desc, eq, isNull } from 'drizzle-orm'

function formatCurrency(cents: number): string {
  if (!cents) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

function formatScheduled(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function channelsFromCampaign(campaign: CampaignWithStats): VentoraCampaignRow['channels'] {
  const channels = new Set<VentoraCampaignRow['channels'][number]>()
  for (const step of campaign.workflow.steps ?? []) {
    if (step.channel === 'linkedin') channels.add('linkedin')
    if (step.channel === 'email' || step.channel === 'sms') channels.add('email')
  }
  if (channels.size === 0) channels.add('email')
  return [...channels]
}

function conversionRate(campaign: CampaignWithStats): number {
  const { enrolled, replied, meetings } = campaign.metrics
  if (enrolled <= 0) return 0
  const rate = ((replied + meetings) / enrolled) * 100
  return Math.min(100, Math.round(rate))
}

function mapCampaignRow(campaign: CampaignWithStats): VentoraCampaignRow {
  const status: VentoraCampaignRow['status'] =
    campaign.status === 'active' ? 'active' : 'paused'

  return {
    id: campaign.id,
    name: campaign.name,
    channels: channelsFromCampaign(campaign),
    scheduled: formatScheduled(campaign.updatedAt),
    status,
    conversionRate: conversionRate(campaign),
    nested: true,
    href: `/admin/outreach/campaigns/${campaign.id}`,
  }
}

function buildCampaignGroups(campaigns: CampaignWithStats[]): VentoraCampaignGroup[] {
  if (campaigns.length === 0) return []

  const queued = campaigns.filter((c) => c.status === 'draft' || c.status === 'paused')
  const live = campaigns.filter((c) => c.status === 'active')
  const groups: VentoraCampaignGroup[] = []

  if (queued.length > 0) {
    groups.push({
      id: 'queued',
      name: 'Queued outreach',
      count: queued.length,
      rows: queued.map(mapCampaignRow),
    })
  }

  if (live.length > 0) {
    groups.push({
      id: 'live',
      name: 'Live campaigns',
      count: live.length,
      rows: live.map(mapCampaignRow),
    })
  }

  const rest = campaigns.filter(
    (c) => !queued.includes(c) && !live.includes(c),
  )
  if (rest.length > 0) {
    groups.push({
      id: 'other',
      name: 'Completed',
      count: rest.length,
      rows: rest.map(mapCampaignRow),
    })
  }

  return groups
}

function computeConversionLabel(
  campaigns: CampaignWithStats[],
  snapshot: DashboardSnapshot,
): string {
  const totalEnrolled = campaigns.reduce((n, c) => n + c.metrics.enrolled, 0)
  const totalResponded = campaigns.reduce(
    (n, c) => n + c.metrics.replied + c.metrics.meetings,
    0,
  )

  if (totalEnrolled > 0) {
    const pct = Math.min(100, Math.round((totalResponded / totalEnrolled) * 100))
    return `${pct}%`
  }

  const openDeals = snapshot.deals.filter((d) => !d.isTerminalWin && !d.isTerminalLoss)
  if (openDeals.length > 0) {
    const avg = Math.round(
      openDeals.reduce((s, d) => s + d.closeProbability, 0) / openDeals.length,
    )
    return `${avg}%`
  }

  const won = snapshot.deals.filter((d) => d.isTerminalWin).length
  if (snapshot.deals.length > 0) {
    return `${Math.round((won / snapshot.deals.length) * 100)}%`
  }

  return '0%'
}

function computeRevenueLabel(snapshot: DashboardSnapshot): string {
  if (snapshot.wonValueCents > 0) {
    return formatCurrency(snapshot.wonValueCents)
  }
  return formatCurrency(snapshot.pipelineValueCents)
}

function computeScheduledLabel(campaigns: CampaignWithStats[]): string {
  const draftCampaigns = campaigns.filter((c) => c.status === 'draft').length
  const pendingEnrollments = campaigns.reduce(
    (n, c) => n + Math.max(0, c.metrics.enrolled - c.metrics.sent),
    0,
  )
  const queued = draftCampaigns + pendingEnrollments
  return `${queued} Queued`
}

function aiCopy(
  insights: EmbeddedInsight[],
  snapshot: DashboardSnapshot,
): { headline: string; body: string; progress: number } {
  const top = insights[0]
  if (top) {
    return {
      headline: 'Ventora AI',
      body: top.recommendation || top.headline,
      progress: Math.min(95, 40 + insights.length * 12),
    }
  }

  if (snapshot.isEmpty) {
    return {
      headline: 'Ventora AI',
      body: 'Connect your pipeline and launch outreach — we will surface priorities and draft personalized sequences for you.',
      progress: 24,
    }
  }

  const atRisk = snapshot.clients.filter((c) => c.healthStatus === 'at_risk').length
  if (atRisk > 0) {
    return {
      headline: 'Ventora AI',
      body: `${atRisk} client${atRisk === 1 ? '' : 's'} need attention this week. Review churn signals and schedule check-ins from your action feed.`,
      progress: 68,
    }
  }

  return {
    headline: 'Ventora AI',
    body: "We've built out your pipeline for your outreach campaign.",
    progress: 68,
  }
}

export async function getVentoraDashboardPayload(
  accountId: string,
  snapshot: DashboardSnapshot,
  embeddedInsights: EmbeddedInsight[],
): Promise<VentoraDashboardPayload> {
  const [campaigns, leadRows] = await Promise.all([
    findOutreachCampaigns(accountId).catch(() => [] as CampaignWithStats[]),
    db
      .select({ createdAt: leads.createdAt })
      .from(leads)
      .where(and(eq(leads.accountId, accountId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.createdAt))
      .limit(200)
      .catch(() => [] as { createdAt: Date }[]),
  ])

  const metrics = [
    {
      label: 'Conversion',
      value: computeConversionLabel(campaigns, snapshot),
      iconName: 'trophy' as const,
    },
    {
      label: 'Revenue',
      value: computeRevenueLabel(snapshot),
      iconName: 'grid' as const,
    },
    {
      label: 'Scheduled',
      value: computeScheduledLabel(campaigns),
      iconName: 'calendar' as const,
    },
  ]

  const chartData = buildMonthlyOverview(leadRows)

  const ai = aiCopy(embeddedInsights, snapshot)

  return {
    metrics,
    chartData,
    highlightMonth: currentMonthAbbrev(),
    aiHeadline: ai.headline,
    aiBody: ai.body,
    aiProgress: ai.progress,
    campaignGroups: buildCampaignGroups(campaigns),
  }
}
