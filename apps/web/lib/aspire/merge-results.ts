import type { AspireSearchResult } from '@/lib/aspire/types'

export function aspireResultKey(row: AspireSearchResult, fallbackIndex = 0): string {
  return row.id || row.email || row.linkedinUrl || `row-${fallbackIndex}`
}

/** Merge DB/live rows by stable key, preferring incoming scores and contact fields. */
export function mergeAspireResults(
  existing: AspireSearchResult[],
  incoming: AspireSearchResult[],
): AspireSearchResult[] {
  const merged = new Map<string, AspireSearchResult>()

  existing.forEach((row, index) => {
    merged.set(aspireResultKey(row, index), row)
  })

  incoming.forEach((row, index) => {
    const key = aspireResultKey(row, index)
    const prev = merged.get(key)
    merged.set(key, prev ? { ...prev, ...row } : row)
  })

  return Array.from(merged.values()).sort(
    (a, b) => (b.icpScore ?? b.intentScore ?? 0) - (a.icpScore ?? a.intentScore ?? 0),
  )
}
