import type { VentoraMonthlyPoint } from '@/lib/dashboard/ventora-types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Monthly lead volume from account data — no synthetic filler bars. */
export function buildMonthlyOverview(
  points: { createdAt: string | Date }[],
): VentoraMonthlyPoint[] {
  const counts = new Array(12).fill(0)
  const year = new Date().getFullYear()

  for (const point of points) {
    const d = new Date(point.createdAt)
    if (Number.isNaN(d.getTime())) continue
    if (d.getFullYear() === year) {
      counts[d.getMonth()] += 1
    }
  }

  return MONTHS.map((month, i) => {
    const total = counts[i] ?? 0
    return { month, solid: total, hatch: 0, total }
  })
}

export function currentMonthAbbrev(): string {
  return MONTHS[new Date().getMonth()] ?? 'Jan'
}
