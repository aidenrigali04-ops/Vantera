import { formatUsdFromCents } from '@/lib/contacts/format'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import type { PortalInvoice } from '@/lib/portal/types'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

type PortalInvoicesPanelProps = {
  invoices: PortalInvoice[]
}

function invoiceTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success'
  if (status === 'overdue') return 'danger'
  if (status === 'sent' || status === 'viewed') return 'warning'
  return 'neutral'
}

function invoiceLabel(status: string): string {
  if (status === 'paid') return 'Paid'
  if (status === 'overdue') return 'Overdue'
  if (status === 'viewed') return 'Viewed'
  if (status === 'sent') return 'Due'
  return status
}

export function PortalInvoicesPanel({ invoices }: PortalInvoicesPanelProps) {
  if (invoices.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        No invoices yet. When billing is ready, you&apos;ll pay securely from here.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {invoices.map((invoice) => {
        const balance = Math.max(0, invoice.amountCents - invoice.paidCents)
        const canPay = balance > 0 && invoice.paymentLinkUrl

        return (
          <li
            key={invoice.id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {invoice.recordTitle ?? 'Invoice'}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  {formatUsdFromCents(balance > 0 ? balance : invoice.amountCents)}
                </p>
                {invoice.dueAt ? (
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    Due{' '}
                    {invoice.dueAt.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>
              <StatusBadge label={invoiceLabel(invoice.status)} tone={invoiceTone(invoice.status)} />
            </div>
            {canPay ? (
              <Button size="sm" className="mt-3 h-8" asChild>
                <a href={invoice.paymentLinkUrl!} target="_blank" rel="noopener noreferrer">
                  Pay now
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
