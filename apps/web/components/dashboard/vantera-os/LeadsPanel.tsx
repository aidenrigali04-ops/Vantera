'use client'

import type { DashboardLeadRow } from '@/lib/dashboard/panels'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Props = {
  leads: DashboardLeadRow[]
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Discovery',
  proposal_sent: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

/** Figma: Leads panel — capsule rows with hairline rings, blue fill on hover/active. */
export function LeadsPanel({ leads }: Props) {
  return (
    <motion.section variants={fadeUp} className="vantera-leads-panel rounded-3xl p-6">
      <div className="mb-4 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Leads</h2>
        <Link
          href="/admin/leads"
          aria-label="View all leads"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] px-6 py-10 text-center">
          <p className="text-[13px] text-[var(--text-tertiary)]">
            No leads yet — your agent&rsquo;s prospects will land here.
          </p>
          <Link
            href="/admin/sdr-agents"
            className="vision-cta-btn rounded-full px-4 py-2 text-[12px] font-semibold text-white"
          >
            Launch agent
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {leads.map((lead, i) => (
            <li key={lead.id}>
              <Link
                href={`/admin/leads/${lead.id}`}
                data-active={i === 0 || undefined}
                className="vantera-lead-row group flex items-center gap-3 rounded-full px-4 py-2.5"
              >
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)] group-hover:text-white group-data-[active]:text-white"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)] group-hover:text-white group-data-[active]:text-white">
                  {lead.name}
                  <span className="ml-2 font-normal text-[var(--text-tertiary)] group-hover:text-white/70 group-data-[active]:text-white/70">
                    {lead.company}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)] group-hover:text-white/80 group-data-[active]:text-white/80">
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-[var(--text-disabled)] group-hover:text-white group-data-[active]:text-white"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  )
}
