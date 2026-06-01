import type { PortalProject } from '@/lib/portal/types'
import { cn } from '@/lib/utils'
import { formatUsdFromCents } from '@/lib/contacts/format'

type PortalProjectCardProps = {
  project: PortalProject
}

export function PortalProjectCard({ project }: PortalProjectCardProps) {
  return (
    <article className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-stone-900">{project.title}</h3>
          <p className="mt-0.5 text-[12px] text-stone-500">{formatUsdFromCents(project.valueCents)}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: project.stageColor }}
        >
          {project.stageLabel}
        </span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-stone-500">
          <span>Progress</span>
          <span className="tabular-nums font-medium text-stone-700">{project.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              project.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500',
            )}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
    </article>
  )
}
