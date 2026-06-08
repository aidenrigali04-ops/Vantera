import type { ProspectSearchFilters } from '@/lib/aspire/types'
import { buildScoutApifyFilters } from '@/lib/prospect-scout/filters'
import type { SdrConfigRow } from '@/lib/prospect-scout/types'
import { db } from '@/lib/db/client'
import { sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'

const ROTATION_KEY = 'scoutRotationIndex'

export function readScoutRotationIndex(icpConfig: unknown): number {
  if (!icpConfig || typeof icpConfig !== 'object') return 0
  const value = (icpConfig as Record<string, unknown>)[ROTATION_KEY]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

export async function persistScoutRotationIndex(
  configId: string,
  icpConfig: unknown,
  nextIndex: number,
): Promise<void> {
  const base =
    icpConfig && typeof icpConfig === 'object'
      ? { ...(icpConfig as Record<string, unknown>) }
      : {}

  await db
    .update(sdrAgentConfigs)
    .set({
      icpConfig: { ...base, [ROTATION_KEY]: nextIndex },
      updatedAt: new Date(),
    })
    .where(eq(sdrAgentConfigs.id, configId))
}

function rotateSlice<T>(items: T[], runIndex: number, take: number): T[] {
  if (items.length === 0) return items
  if (items.length <= take) return items
  const start = (runIndex * take) % items.length
  const slice: T[] = []
  for (let i = 0; i < take; i += 1) {
    slice.push(items[(start + i) % items.length]!)
  }
  return slice
}

/**
 * Vary Apify filters per scheduled run so each pull targets a different slice of the ICP.
 * Apify returns a new batch; we avoid re-fetching the same default title/location combo every day.
 */
export function buildRotatedScoutApifyFilters(
  config: SdrConfigRow,
  runIndex: number,
): ProspectSearchFilters {
  const base = buildScoutApifyFilters(config)

  const titles = base.jobTitles ?? []
  if (titles.length > 2) {
    base.jobTitles = rotateSlice(titles, runIndex, Math.min(4, titles.length))
  }

  const industries = base.industries ?? []
  if (industries.length > 1) {
    const focus = industries[runIndex % industries.length]!
    const rest = industries.filter((item) => item !== focus)
    base.industries = [focus, ...rest.slice(0, 2)]
  }

  const sizes = base.companySizeRanges ?? []
  if (sizes.length > 1) {
    base.companySizeRanges = [sizes[runIndex % sizes.length]!]
  }

  const locations = base.locations ?? []
  if (locations.length > 1) {
    base.locations = rotateSlice(locations, runIndex, Math.min(2, locations.length))
  }

  const icp = config.icpConfig as { targetTitles?: string[] }
  const seedTitles = icp.targetTitles ?? titles
  if (seedTitles.length > 0) {
    const seed = seedTitles[runIndex % seedTitles.length]
    if (seed) {
      base.q = seed
    }
  }

  return base
}
