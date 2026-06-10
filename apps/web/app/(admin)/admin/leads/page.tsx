import { LeadsTable } from '@/components/leads/LeadsTable'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeadsWithProfiles, getLeadPipelineStats } from '@/lib/leads/queries'
import {
  LEAD_STAGE_LABELS,
  LEAD_STAGE_ORDER,
  buildEnrichedLeadRow,
} from '@/lib/leads/table-rows'
import { cn } from '@/lib/utils'
import { Bot } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ stage?: string }>
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const session = await requireAdminSession()
  const params = await searchParams
  const stage =
    params.stage && LEAD_STAGE_ORDER.includes(params.stage as (typeof LEAD_STAGE_ORDER)[number])
      ? params.stage
      : undefined

  const [rows, stats] = await Promise.all([
    findLeadsWithProfiles(session.accountId, {
      limit: 100,
      relationshipStatus: stage,
    }),
    getLeadPipelineStats(session.accountId),
  ])

  const leads = rows.map(({ lead, profile }) => buildEnrichedLeadRow(lead, profile))
  const countByStage = new Map<string, number>(
    stats.byStatus.map((row): [string, number] => [row.status, Number(row.count)]),
  )
  const total = stats.total
  const shown = leads.length

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          Pipeline
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
          Every lead your agent has sourced — {total.toLocaleString()} total
          {shown < total && !stage ? ` · ${shown} shown` : ''}.
        </p>
      </header>

      {/* Stage counts — click to filter the table to one stage. */}
      {total > 0 ? (
        <div className="flex flex-wrap gap-2">
          {LEAD_STAGE_ORDER.filter((s) => (countByStage.get(s) ?? 0) > 0).map((s) => {
            const active = stage === s
            return (
              <Link
                key={s}
                href={active ? '/admin/leads' : `/admin/leads?stage=${s}`}
                className={cn(
                  'rounded-lg border px-3 py-2 transition-colors',
                  active
                    ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                )}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  {LEAD_STAGE_LABELS[s] ?? s}
                </p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {countByStage.get(s)}
                </p>
              </Link>
            )
          })}
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
            className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Open agent
          </Link>
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-default)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            No leads in {LEAD_STAGE_LABELS[stage ?? ''] ?? 'this stage'} yet.
          </p>
          <Link
            href="/admin/leads"
            className="mt-2 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Show all stages
          </Link>
        </div>
      ) : (
        <LeadsTable rows={leads} />
      )}
    </div>
  )
}
