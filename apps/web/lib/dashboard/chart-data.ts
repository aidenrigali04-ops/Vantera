import type { VentoraMonthlyPoint } from '@/lib/dashboard/ventora-types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function buildMonthlyOverview(
  points: { createdAt: string | Date }[],
  fallbackPeak = 45,
): VentoraMonthlyPoint[] {
  const counts = new Array(12).fill(0)
  const year = new Date().getFullYear()

  for (const point of points) {
    const d = new Date(point.createdAt)
    if (d.getFullYear() === year) {
      counts[d.getMonth()] += 1
    }
  }

  const max = Math.max(...counts, 1)

  return MONTHS.map((month, i) => {
    const raw = counts[i] || Math.round((fallbackPeak * (0.4 + (i / 12) * 0.6)) / 12)
    const normalized = counts[i] > 0 ? counts[i] : raw
    const solid = Math.max(4, Math.round((normalized / max) * fallbackPeak * 0.55))
    const hatch = Math.max(2, Math.round((normalized / max) * fallbackPeak * 0.35))
    return { month, solid, hatch }
  })
}

export function currentMonthAbbrev(): string {
  return MONTHS[new Date().getMonth()] ?? 'Jan'
}
