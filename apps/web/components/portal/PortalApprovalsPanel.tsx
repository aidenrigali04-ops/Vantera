import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import type { PortalApproval } from '@/lib/portal/types'
import { formatRelativeTime } from '@/lib/contacts/format'
import { ExternalLink } from 'lucide-react'

type PortalApprovalsPanelProps = {
  approvals: PortalApproval[]
}

function approvalTone(status: PortalApproval['status']): 'warning' | 'success' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

export function PortalApprovalsPanel({ approvals }: PortalApprovalsPanelProps) {
  const pending = approvals.filter((a) => a.status === 'pending')

  if (pending.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        No approvals waiting on you right now.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {pending.map((approval) => (
        <li
          key={approval.id}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">{approval.title}</p>
            <StatusBadge label="Pending" tone={approvalTone(approval.status)} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Requested {formatRelativeTime(approval.requestedAt)}
          </p>
          <Button size="sm" className="mt-3 h-8" asChild>
            <a href={approval.storageUrl} target="_blank" rel="noopener noreferrer">
              Review document
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
        </li>
      ))}
    </ul>
  )
}
