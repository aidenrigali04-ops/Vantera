'use client'

import {
  LeadContactCell,
  LeadIdentityCell,
  LeadIndustryCell,
  LeadQualityCell,
  LeadStageBadge,
} from '@/components/leads/LeadTableCells'
import type { EnrichedLeadRow } from '@/lib/leads/table-rows'
import { useRouter } from 'next/navigation'

type Props = {
  rows: EnrichedLeadRow[]
}

const HEADINGS = ['Lead', 'Quality', 'Industry', 'Contact', 'Stage', 'Source'] as const

/** Enriched pipeline table — identity, quality, firmographics, and contact data per lead. */
export function LeadsTable({ rows }: Props) {
  const router = useRouter()

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left">
          <tr>
            {HEADINGS.map((heading) => (
              <th
                key={heading}
                className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/admin/leads/${row.id}`)}
              className="cursor-pointer align-top transition-colors hover:bg-[var(--bg-overlay)]"
            >
              <td className="px-4 py-3">
                <LeadIdentityCell row={row} />
              </td>
              <td className="px-4 py-3">
                <LeadQualityCell row={row} />
              </td>
              <td className="px-4 py-3">
                <LeadIndustryCell row={row} />
              </td>
              <td className="px-4 py-3">
                <LeadContactCell row={row} />
              </td>
              <td className="px-4 py-3">
                <LeadStageBadge stage={row.stage} />
              </td>
              <td className="px-4 py-3 text-[12px] capitalize text-[var(--text-tertiary)]">
                {row.source.replace(/_/g, ' ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
