'use client'

import { IconTile } from '@/components/shared/IconTile'
import { qualityUiForTier } from '@/lib/aspire/lead-quality-ui'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { getProspectEnrichmentFields } from '@/lib/aspire/enrich-prospect'
import { cn } from '@/lib/utils'
import { Database, Mail, Sparkles, Target, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  rows: AspireSearchResult[]
  className?: string
}

type MetricCard = {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  iconClassName?: string
}

function resolveRowMetrics(row: AspireSearchResult) {
  if (row.enrichmentScore != null && row.enrichmentTier) {
    return {
      icp: row.icpScore,
      enrichment: row.enrichmentScore,
      tier: row.enrichmentTier,
      completeness: row.enrichmentCompleteness,
    }
  }
  const fields = getProspectEnrichmentFields(row, row.icpScore, row.icpSignals)
  return {
    icp: row.icpScore,
    enrichment: fields.enrichmentScore,
    tier: fields.enrichmentTier,
    completeness: fields.enrichmentCompleteness,
  }
}

export function AspireMetricsBar({ rows, className }: Props) {
  const metrics = rows.map(resolveRowMetrics)
  const withEmail = rows.filter((r) => Boolean(r.email)).length
  const strongIcp = metrics.filter((m) => m.icp >= 70).length
  const excellent = metrics.filter((m) => m.tier === 'excellent').length
  const avgEnrichment =
    metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.enrichment, 0) / metrics.length)
      : 0
  const avgCompleteness =
    metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.completeness, 0) / metrics.length)
      : 0

  const cards: MetricCard[] = [
    {
      label: 'Prospects',
      value: rows.length,
      icon: Users,
    },
    {
      label: 'Strong ICP',
      value: strongIcp,
      hint: '70+ fit',
      icon: Target,
    },
    {
      label: 'Excellent quality',
      value: excellent,
      hint: 'ICP + enrichment',
      icon: Sparkles,
      iconClassName: qualityUiForTier('excellent').barColor,
    },
    {
      label: 'With email',
      value: withEmail,
      icon: Mail,
      iconClassName: 'text-[var(--success)]',
    },
    {
      label: 'Avg enrichment',
      value: `${avgEnrichment}%`,
      hint: `${avgCompleteness}% data complete`,
      icon: Database,
    },
  ]

  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        className,
      )}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-sm)]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              {card.label}
            </p>
            <IconTile icon={card.icon} size="xs" iconClassName={card.iconClassName} />
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.02em] text-[var(--text-primary)]">
            {card.value}
          </p>
          {card.hint ? (
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{card.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
