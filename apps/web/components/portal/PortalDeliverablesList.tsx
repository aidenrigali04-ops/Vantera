import { StatusBadge } from '@/components/operational/table/StatusBadge'
import type { PortalDeliverable } from '@/lib/portal/types'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

type PortalDeliverablesListProps = {
  deliverables: PortalDeliverable[]
}

function deliverableTone(
  status: PortalDeliverable['status'],
): 'neutral' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'delivered':
      return 'success'
    case 'approved':
      return 'success'
    case 'in_review':
      return 'info'
    default:
      return 'warning'
  }
}

function deliverableLabel(status: PortalDeliverable['status']): string {
  switch (status) {
    case 'delivered':
      return 'Delivered'
    case 'approved':
      return 'Approved'
    case 'in_review':
      return 'In review'
    default:
      return 'Pending'
  }
}

export function PortalDeliverablesList({ deliverables }: PortalDeliverablesListProps) {
  if (deliverables.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        Deliverables will appear here as your team shares work for review.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {deliverables.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5"
        >
          <span className="min-w-0 truncate text-[13px] text-[var(--text-primary)]">{item.title}</span>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge label={deliverableLabel(item.status)} tone={deliverableTone(item.status)} />
            <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
              <a href={item.storageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="sr-only">Open {item.title}</span>
              </a>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
