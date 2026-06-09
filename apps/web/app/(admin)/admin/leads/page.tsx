import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeads, getLeadPipelineStats } from '@/lib/leads/queries'
import { Bot } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Call booked',
  proposal_sent: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}
const STAGE_ORDER = [
  'new',
  'contacted',
  'connected',
  'nurturing',
  'qualified',
  'discovery_booked',
  'proposal_sent',
  'won',
  'lost',
]

type LeadRow = Awaited<ReturnType<typeof findLeads>>[number]

function fullName(lead: LeadRow): string {
  const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim()
  return name || '—'
}

export default async function PipelinePage() {
  const session = await requireAdminSession()
  const [leads, stats] = await Promise.all([
    findLeads(session.accountId, { limit: 100 }),
    getLeadPipelineStats(session.accountId),
  ])

  const countByStage = new Map<string, number>(
    stats.byStatus.map((row): [string, number] => [row.status, Number(row.count)]),
  )
  const total = stats.total
  const shown = leads.length

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Pipeline</h1>
        <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
          Every lead your agent has sourced — {total.toLocaleString()} total
          {shown < total ? ` · ${shown} shown` : ''}.
        </p>
      </header>

      {/* Stage counts — answer "where is everything?" at a glance. */}
      {total > 0 ? (
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.filter((stage) => (countByStage.get(stage) ?? 0) > 0).map((stage) => (
            <div key={stage} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                {STATUS_LABELS[stage] ?? stage}
              </p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{countByStage.get(stage)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] py-16 text-center">
          <Bot className="h-8 w-8 text-[var(--text-disabled)]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">No leads yet</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--text-tertiary)]">
            Your SDR agent fills this as it prospects. Pull your first batch to get started.
          </p>
          <Link
            href="/admin/sdr-agents"
            className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Open agent
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left">
              <tr>
                {['Name', 'Company', 'Title', 'Score', 'Stage', 'Source'].map((heading) => (
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
              {leads.map((lead) => (
                <tr key={lead.id} className="cursor-pointer transition-colors hover:bg-[var(--bg-overlay)]">
                  <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                    <Link href={`/admin/leads/${lead.id}`} className="block hover:text-[var(--accent)]">
                      {fullName(lead)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                    <Link href={`/admin/leads/${lead.id}`} className="block">
                      {lead.company}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                    <Link href={`/admin/leads/${lead.id}`} className="block">
                      {lead.title ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">
                    <Link href={`/admin/leads/${lead.id}`} className="block">
                      {lead.score ?? 0}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                    <Link href={`/admin/leads/${lead.id}`} className="block">
                      {STATUS_LABELS[lead.relationshipStatus] ?? lead.relationshipStatus}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-tertiary)]">
                    <Link href={`/admin/leads/${lead.id}`} className="block">
                      {lead.source}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
