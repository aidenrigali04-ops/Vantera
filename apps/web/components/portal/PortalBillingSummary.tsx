import { formatUsdFromCents } from '@/lib/contacts/format'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import type { PortalBillingSummary } from '@/lib/portal/types'

type PortalBillingSummaryProps = {
  billing: PortalBillingSummary
}

function billingTone(status: PortalBillingSummary['status']): 'success' | 'warning' | 'danger' {
  if (status === 'overdue') return 'danger'
  if (status === 'due_soon') return 'warning'
  return 'success'
}

function billingLabel(status: PortalBillingSummary['status']): string {
  if (status === 'overdue') return 'Overdue'
  if (status === 'due_soon') return 'Due soon'
  return 'Current'
}

export function PortalBillingSummary({ billing }: PortalBillingSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-stone-600">Outstanding balance</span>
        <StatusBadge label={billingLabel(billing.status)} tone={billingTone(billing.status)} />
      </div>
      <p className="text-2xl font-semibold tracking-[-0.02em] text-stone-900">
        {formatUsdFromCents(billing.outstandingCents)}
      </p>
      {billing.nextDueDate ? (
        <p className="text-[12px] text-stone-500">
          Next invoice due{' '}
          {billing.nextDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      ) : (
        <p className="text-[12px] text-stone-500">No upcoming invoices</p>
      )}
    </div>
  )
}
