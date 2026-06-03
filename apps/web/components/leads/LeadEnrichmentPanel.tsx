'use client'

import { qualityUiForTier } from '@/lib/aspire/lead-quality-ui'
import type { LeadProspectEnrichment } from '@/lib/leads/enrichment'
import type { leads } from '@vantera/db'

type Props = {
  lead: typeof leads.$inferSelect
}

function asEnrichment(raw: unknown): LeadProspectEnrichment | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.enrichmentScore !== 'number' || typeof row.qualityTier !== 'string') {
    return null
  }
  return row as LeadProspectEnrichment
}

export function LeadEnrichmentPanel({ lead }: Props) {
  const enrichment = asEnrichment(lead.enrichment)
  if (!enrichment) return null

  const tierUi = qualityUiForTier(enrichment.qualityTier)

  return (
    <div
      className="rounded-xl border border-[var(--border-default)] px-4 py-3"
      style={{ background: `linear-gradient(135deg, ${tierUi.mutedBg}, var(--bg-surface))` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          Enrichment
        </p>
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: tierUi.barColor, backgroundColor: tierUi.mutedBg }}
        >
          {tierUi.label}
        </span>
      </div>
      <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
        {enrichment.enrichmentScore}% data score · {enrichment.completenessPct}% profile complete
      </p>
      <ul className="mt-2 space-y-1 text-[12px] text-[var(--text-secondary)]">
        {enrichment.websiteUrl ? <li>Website: {enrichment.websiteUrl}</li> : null}
        {enrichment.employeeCount != null ? <li>~{enrichment.employeeCount} employees</li> : null}
        {enrichment.technologies?.length ? (
          <li>Tech: {enrichment.technologies.slice(0, 5).join(', ')}</li>
        ) : null}
        {enrichment.profile?.disc ? <li>DISC profile: {enrichment.profile.disc}</li> : null}
      </ul>
    </div>
  )
}
