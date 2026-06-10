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

export type DashboardPanels = {
  /** Replies / contacted over the last 30 days (0–100). */
  replyRate: number
  /** Won leads / total leads (0–100). */
  closeRate: number
  totalLeads: number
  stageBreakdown: StageSlice[]
  leads: DashboardLeadRow[]
  revenueSeries: RevenuePoint[]
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
