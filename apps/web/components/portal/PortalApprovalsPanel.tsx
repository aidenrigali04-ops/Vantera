import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import type { PortalApproval } from '@/lib/portal/types'
import { formatRelativeTime } from '@/lib/contacts/format'

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
      <p className="text-[13px] text-stone-500">No approvals waiting on you right now.</p>
    )
  }

  return (
    <ul className="space-y-3">
      {pending.map((approval) => (
        <li
          key={approval.id}
          className="rounded-lg border border-stone-200 bg-stone-50/50 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium text-stone-900">{approval.title}</p>
            <StatusBadge label="Pending" tone={approvalTone(approval.status)} />
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            Requested {formatRelativeTime(approval.requestedAt)}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-8 bg-stone-900 hover:bg-stone-800">
              Review
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled title="Coming soon">
              Decline
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
