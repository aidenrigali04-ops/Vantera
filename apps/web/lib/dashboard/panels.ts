/**
 * Vantera OS dashboard panel data — serializable payload built server-side
 * for the Figma dashboard composition (metric gauges, leads list, stage
 * donut, revenue trend).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export type DashboardLeadRow = {
  id: string
  name: string
  company: string
  title: string | null
  status: string
  /** Lead score 0–100. */
  score: number
  /** Enrichment quality tier when the lead has been enriched. */
  qualityTier: 'excellent' | 'strong' | 'moderate' | 'weak' | null
  /** Which contact channels are on file. */
  channels: {
    email: boolean
    phone: boolean
    linkedin: boolean
  }
}

export type StageSlice = {
  label: string
  count: number
  pct: number
}

export type RevenuePoint = {
  month: string
  revenue: number
  pipeline: number
}

/** "Here's what's new" chip in the welcome panel. */
export type WelcomeUpdate = {
  id: string
  text: string
  href: string
}

export type DashboardPanels = {
  /** Replies / contacted over the last 30 days (0–100). */
  replyRate: number
  /** Won leads / total leads (0–100). */
  closeRate: number
  totalLeads: number
  stageBreakdown: StageSlice[]
  leads: DashboardLeadRow[]
  revenueSeries: RevenuePoint[]
  updates: WelcomeUpdate[]
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Discovery booked',
  proposal_sent: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
}

/** Won + late-stage statuses that count as pipeline value. */
const PIPELINE_STATUSES = new Set(['qualified', 'discovery_booked', 'proposal_sent', 'won'])

/** Build "Here's what's new" chips from real activity — most newsworthy first, max 3. */
export function buildWelcomeUpdates(input: {
  repliesThisWeek: number
  leadsFoundToday: number
  meetingsThisWeek: number
  currentMrr: number
}): WelcomeUpdate[] {
  const updates: WelcomeUpdate[] = []

  if (input.repliesThisWeek > 0) {
    updates.push({
      id: 'replies',
      text: `${input.repliesThisWeek} new ${input.repliesThisWeek === 1 ? 'reply' : 'replies'} this week`,
      href: '/admin/inbox',
    })
  }
  if (input.meetingsThisWeek > 0) {
    updates.push({
      id: 'meetings',
      text: `${input.meetingsThisWeek} ${input.meetingsThisWeek === 1 ? 'meeting' : 'meetings'} booked this week`,
      href: '/admin/leads',
    })
  }
  if (input.leadsFoundToday > 0) {
    updates.push({
      id: 'scout',
      text: `Scout pulled ${input.leadsFoundToday} more ${input.leadsFoundToday === 1 ? 'lead' : 'leads'} today`,
      href: '/admin/leads',
    })
  }
  if (input.currentMrr > 0) {
    const k = input.currentMrr / 1000
    updates.push({
      id: 'revenue',
      text: `Revenue reached $${k >= 1 ? `${Math.floor(k)}k` : Math.round(input.currentMrr).toLocaleString()}`,
      href: '/admin/dashboard',
    })
  }

  return updates.slice(0, 3)
}

export function buildStageBreakdown(
  byStatus: { status: string; count: number }[],
): { slices: StageSlice[]; total: number } {
  const total = byStatus.reduce((s, r) => s + r.count, 0)
  if (total === 0) return { slices: [], total: 0 }

  const sorted = [...byStatus].sort((a, b) => b.count - a.count)
  const top = sorted.slice(0, 4)
  const rest = sorted.slice(4).reduce((s, r) => s + r.count, 0)

  const slices = top.map((r) => ({
    label: STAGE_LABELS[r.status] ?? r.status,
    count: r.count,
    pct: Math.round((r.count / total) * 100),
  }))
  if (rest > 0) {
    slices.push({ label: 'Other', count: rest, pct: Math.round((rest / total) * 100) })
  }
  return { slices, total }
}

export function buildRevenueSeries(
  timeline: { createdAt: Date; relationshipStatus: string }[],
  avgValue: number | null,
): RevenuePoint[] {
  const now = new Date()
  const year = now.getFullYear()
  const lastMonth = now.getMonth()
  const value = avgValue ?? 0

  const wonByMonth = new Array<number>(12).fill(0)
  const pipelineByMonth = new Array<number>(12).fill(0)

  for (const row of timeline) {
    const d = new Date(row.createdAt)
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue
    const m = d.getMonth()
    if (row.relationshipStatus === 'won') wonByMonth[m] = (wonByMonth[m] ?? 0) + 1
    if (PIPELINE_STATUSES.has(row.relationshipStatus)) {
      pipelineByMonth[m] = (pipelineByMonth[m] ?? 0) + 1
    }
  }

  const points: RevenuePoint[] = []
  let wonRunning = 0
  let pipelineRunning = 0
  for (let m = 0; m <= lastMonth; m++) {
    wonRunning += wonByMonth[m] ?? 0
    pipelineRunning += pipelineByMonth[m] ?? 0
    points.push({
      month: MONTHS[m] ?? '',
      revenue: wonRunning * value,
      pipeline: pipelineRunning * value,
    })
  }
  return points
}
