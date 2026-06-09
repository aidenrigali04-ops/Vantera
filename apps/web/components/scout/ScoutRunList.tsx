import Link from 'next/link'
import { ArrowRight, Clock, CheckCircle2, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

type RunSummary = {
  id: string
  name: string
  runFrequency: string
  lastRunAt: string | null
  isActive: boolean
  resultCount: number
  enrolledCount: number
}

function formatDate(d: string | null | undefined) {
  if (!d) return 'Never'
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ScoutRunList({ runs }: { runs: RunSummary[] }) {
  if (runs.length === 0) return null

  return (
    <div className="client-detail rounded-[10px] bg-[var(--cd-bg-card)] overflow-hidden" style={{ boxShadow: 'var(--cd-shadow)' }}>
      <div className="flex items-center justify-between border-b border-[var(--cd-border)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cd-text-primary)]">
          Prospecting Runs
        </p>
        <span className="rounded-full bg-[#102a43] px-2 py-0.5 text-[11px] font-medium text-[var(--cd-accent)]">
          {runs.length}
        </span>
      </div>
      <ul className="divide-y divide-[var(--cd-border)]">
        {runs.map((run) => (
          <li key={run.id}>
            <Link
              href={`/admin/outreach/agents/scout/runs/${encodeURIComponent(run.id)}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#0d1a26]"
            >
              <div className="icon-tile flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                {run.isActive ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Pause className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.75} aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--cd-text-primary)] truncate">{run.name}</p>
                <p className="text-[11px] text-[var(--cd-text-muted)]">
                  {run.runFrequency} · Last ran {formatDate(run.lastRunAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4 text-right">
                <div>
                  <p className="text-[15px] font-semibold text-[var(--cd-text-primary)] tabular-nums">{run.resultCount}</p>
                  <p className="text-[10px] text-[var(--cd-text-muted)]">found</p>
                </div>
                <div>
                  <p className={cn('text-[15px] font-semibold tabular-nums', run.enrolledCount > 0 ? 'text-[var(--cd-text-tag-cyan)]' : 'text-[var(--cd-text-muted)]')}>
                    {run.enrolledCount}
                  </p>
                  <p className="text-[10px] text-[var(--cd-text-muted)]">enrolled</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--cd-text-muted)] transition-colors group-hover:text-[var(--cd-accent)]" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
