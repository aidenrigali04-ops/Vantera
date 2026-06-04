import type { PortalProject } from '@/lib/portal/types'
import { cn } from '@/lib/utils'
import { formatUsdFromCents } from '@/lib/contacts/format'

type PortalPipelineBoardProps = {
  projects: PortalProject[]
  pipelineLabel: string
}

function stageBucket(progress: number): 'active' | 'review' | 'complete' {
  if (progress >= 100) return 'complete'
  if (progress >= 70) return 'review'
  return 'active'
}

const BUCKET_META = {
  active: { title: 'In progress', hint: 'Work underway' },
  review: { title: 'Wrapping up', hint: 'Final delivery' },
  complete: { title: 'Completed', hint: 'Delivered' },
} as const

export function PortalPipelineBoard({ projects, pipelineLabel }: PortalPipelineBoardProps) {
  const buckets = {
    active: [] as PortalProject[],
    review: [] as PortalProject[],
    complete: [] as PortalProject[],
  }

  for (const project of projects) {
    buckets[stageBucket(project.progress)].push(project)
  }

  return (
    <section aria-labelledby="portal-pipeline-heading">
      <div className="mb-4">
        <h2
          id="portal-pipeline-heading"
          className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
        >
          {pipelineLabel}
        </h2>
        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
          Live status across everything your team is delivering.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(BUCKET_META) as Array<keyof typeof BUCKET_META>).map((key) => {
          const meta = BUCKET_META[key]
          const items = buckets[key]

          return (
            <div
              key={key}
              className="flex min-h-[200px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
            >
              <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">{meta.title}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">{meta.hint}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 p-3">
                {items.length === 0 ? (
                  <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-8 text-center text-[12px] text-[var(--text-tertiary)]">
                    No projects here
                  </li>
                ) : (
                  items.map((project) => (
                    <li
                      key={project.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">
                          {project.title}
                        </p>
                        <span
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: project.stageColor }}
                        >
                          {project.stageLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        {formatUsdFromCents(project.valueCents)}
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-base)]">
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width] duration-300 ease-out',
                            project.progress >= 100
                              ? 'bg-[var(--success)]'
                              : 'bg-[var(--accent)]',
                          )}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
