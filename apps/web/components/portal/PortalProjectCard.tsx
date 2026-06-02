import type { PortalProject } from '@/lib/portal/types'
import { cn } from '@/lib/utils'
import { formatUsdFromCents } from '@/lib/contacts/format'

type PortalProjectCardProps = {
  project: PortalProject
}

export function PortalProjectCard({ project }: PortalProjectCardProps) {
  return (
    <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-[var(--text-primary)]">{project.title}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
            {formatUsdFromCents(project.valueCents)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: project.stageColor }}
        >
          {project.stageLabel}
        </span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <span>Progress</span>
          <span className="font-medium tabular-nums text-[var(--text-primary)]">
            {project.progress}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300 ease-out',
              project.progress >= 100 ? 'bg-[var(--success)]' : 'bg-[var(--accent)]',
            )}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
    </article>
  )
}
