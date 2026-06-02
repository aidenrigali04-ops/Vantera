import { formatRelativeTime } from '@/lib/contacts/format'
import type { PortalActivity } from '@/lib/portal/types'

type PortalActivityFeedProps = {
  activities: PortalActivity[]
}

export function PortalActivityFeed({ activities }: PortalActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        No updates yet. Your team will post progress here as work moves forward.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {activities.map((activity) => (
        <li key={activity.id} className="flex gap-3">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
              {activity.body ?? activity.activityType.replace(/_/g, ' ')}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              {formatRelativeTime(activity.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
