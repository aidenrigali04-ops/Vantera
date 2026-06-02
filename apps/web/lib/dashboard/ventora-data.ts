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

function realDeals(snapshot: DashboardSnapshot) {
  return snapshot.deals.filter((deal) => !deal.isSample)
}

function realClients(snapshot: DashboardSnapshot) {
  return snapshot.clients.filter((client) => !client.isSample)
}

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

  const openDeals = realDeals(snapshot).filter((d) => !d.isTerminalWin && !d.isTerminalLoss)
  if (openDeals.length > 0) {
    const avg = Math.round(
      openDeals.reduce((s, d) => s + d.closeProbability, 0) / openDeals.length,
    )
    return `${avg}%`
  }

  const deals = realDeals(snapshot)
  const won = deals.filter((d) => d.isTerminalWin).length
  if (deals.length > 0 && won > 0) {
    return `${Math.round((won / deals.length) * 100)}%`
  }

  return '—'
}

function computeRevenueLabel(snapshot: DashboardSnapshot): string {
  const deals = realDeals(snapshot)
  const wonValueCents = deals.filter((d) => d.isTerminalWin).reduce((n, d) => n + d.valueCents, 0)
  if (wonValueCents > 0) {
    return formatCurrency(wonValueCents)
  }

  const pipelineValueCents = deals
    .filter((d) => !d.isTerminalWin && !d.isTerminalLoss)
    .reduce((n, d) => n + d.valueCents, 0)
  if (pipelineValueCents > 0) {
    return formatCurrency(pipelineValueCents)
  }

  return '—'
}

function computeScheduledLabel(campaigns: CampaignWithStats[]): string {
  const draftCampaigns = campaigns.filter((c) => c.status === 'draft').length
  const pendingEnrollments = campaigns.reduce(
    (n, c) => n + Math.max(0, c.metrics.enrolled - c.metrics.sent),
    0,
  )
  const queued = draftCampaigns + pendingEnrollments
  if (queued <= 0) return '—'
  return `${queued} queued`
}

function aiCopy(
  insights: EmbeddedInsight[],
  snapshot: DashboardSnapshot,
): { headline: string; body: string; progress: number | null } {
  const top = insights[0]
  if (top) {
    return {
      headline: 'Vantera AI',
      body: top.recommendation || top.headline,
      progress: null,
    }
  }

  if (snapshot.isEmpty || (realClients(snapshot).length === 0 && realDeals(snapshot).length === 0)) {
    return {
      headline: 'Vantera AI',
      body: 'Connect your pipeline and launch outreach — priorities and draft sequences will appear here as activity comes in.',
      progress: null,
    }
  }

  const atRisk = realClients(snapshot).filter((c) => c.healthStatus === 'at_risk').length
  if (atRisk > 0) {
    return {
      headline: 'Vantera AI',
      body: `${atRisk} client${atRisk === 1 ? '' : 's'} need attention this week. Review churn signals and schedule check-ins from your action feed.`,
      progress: null,
    }
  }

  return {
    headline: 'Vantera AI',
    body: 'Your workspace is synced. New recommendations will appear here as outreach and pipeline activity grows.',
    progress: null,
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
  const highlightMonth =
    chartData.find((point) => point.total > 0)?.month ?? currentMonthAbbrev()

  const ai = aiCopy(embeddedInsights, snapshot)

  return {
    metrics,
    chartData,
    highlightMonth: chartData.some((point) => point.total > 0) ? highlightMonth : null,
    aiHeadline: ai.headline,
    aiBody: ai.body,
    aiProgress: ai.progress,
    campaignGroups: buildCampaignGroups(campaigns),
  }
}
