import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import Link from 'next/link'

type Props = {
  projects: DashboardSnapshot['projects']
  actionFeed: ActionFeedItem[]
}

export function DashboardTeamWorkloadPanel({ projects, actionFeed }: Props) {
  const overdue = actionFeed.filter((item) => item.type === 'overdue_task').slice(0, 3)
  const activeProjects = projects.slice(0, 4)

  if (activeProjects.length === 0 && overdue.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-stone-500">
        Active projects and assigned tasks will show here as your team gets to work.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {overdue.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
            Needs attention
          </p>
          <ul className="space-y-2">
            {overdue.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 transition-colors hover:bg-amber-50"
                >
                  <p className="text-[13px] font-medium text-stone-900">{item.title}</p>
                  <p className="text-[11px] text-stone-500">{item.subtitle}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeProjects.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
            Active projects
          </p>
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
            {activeProjects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-stone-900">{project.title}</p>
                  <p className="truncate text-[11px] text-stone-500">{project.contactName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                  {project.stageLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
