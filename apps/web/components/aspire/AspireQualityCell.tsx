'use client'

import { getProspectEnrichmentFields } from '@/lib/aspire/enrich-prospect'
import { icpScoreColor, icpScoreLabel } from '@/components/aspire/IcpScoreRing'
import { qualityUiForTier } from '@/lib/aspire/lead-quality-ui'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { cn } from '@/lib/utils'

type Props = {
  row: AspireSearchResult
}

export function AspireQualityCell({ row }: Props) {
  const icp = Math.min(100, Math.max(0, row.icpScore))
  const enrichmentMeta =
    row.enrichmentScore != null && row.enrichmentTier
      ? {
          enrichmentScore: row.enrichmentScore,
          enrichmentTier: row.enrichmentTier,
          enrichmentCompleteness: row.enrichmentCompleteness,
        }
      : getProspectEnrichmentFields(row, icp, row.icpSignals)

  const tierUi = qualityUiForTier(enrichmentMeta.enrichmentTier)

  return (
    <div className="w-full max-w-[140px]">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          ICP
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: tierUi.mutedBg,
            color: tierUi.barColor,
            boxShadow: `inset 0 0 0 1px ${tierUi.ring}`,
          }}
        >
          {tierUi.label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
          {icp}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{icpScoreLabel(icp)}</span>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]"
        role="progressbar"
        aria-valuenow={icp}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`ICP score ${icp}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${icp}%`, backgroundColor: icpScoreColor(icp) }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-1">
        <span className="text-[11px] text-[var(--text-tertiary)]">Enrichment</span>
        <span className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">
          {enrichmentMeta.enrichmentScore}%
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300')}
          style={{
            width: `${enrichmentMeta.enrichmentCompleteness}%`,
            backgroundColor: tierUi.barColor,
          }}
        />
      </div>
    </div>
  )
}
