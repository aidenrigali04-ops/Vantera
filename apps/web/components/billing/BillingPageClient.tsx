'use client'

import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  connectStripeAction,
  createBillingInvoiceAction,
  disconnectStripeAction,
} from '@/lib/billing/actions'
import type { BillingInvoiceRow, InvoiceTargetOption } from '@/lib/billing/queries'
import { formatUsdFromCents } from '@/lib/contacts/format'
import type { StripeConnectionStatus } from '@/lib/integrations/payment-queries'
import { cn } from '@/lib/utils'
import { Check, CreditCard, ExternalLink, Plus, Unplug } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  stripe: StripeConnectionStatus
  invoices: BillingInvoiceRow[]
  targets: InvoiceTargetOption[]
}

function invoiceTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success'
  if (status === 'overdue') return 'danger'
  if (status === 'sent' || status === 'viewed') return 'warning'
  return 'neutral'
}

function invoiceLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
}

export function BillingPageClient({ stripe, invoices, targets }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showConnect, setShowConnect] = useState(!stripe.connected)
  const [secretKey, setSecretKey] = useState('')
  const [publishableKey, setPublishableKey] = useState(stripe.publishableKey ?? '')
  const [targetKey, setTargetKey] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const selectedTarget = targets.find(
    (t) => `${t.contactId}:${t.recordId}` === targetKey,
  )

  function handleConnect() {
    startTransition(async () => {
      const result = await connectStripeAction({
        secretKey,
        publishableKey: publishableKey || undefined,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Stripe connected')
      setSecretKey('')
      setShowConnect(false)
      router.refresh()
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectStripeAction()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Stripe disconnected')
      router.refresh()
    })
  }

  function handleCreateInvoice() {
    if (!selectedTarget) {
      toast.error('Select a client and project')
      return
    }

    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      toast.error('Enter a valid amount (minimum $0.50)')
      return
    }

    startTransition(async () => {
      const result = await createBillingInvoiceAction({
        contactId: selectedTarget.contactId,
        recordId: selectedTarget.recordId,
        amountCents,
        description: description.trim() || 'Invoice',
        daysUntilDue: 14,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Invoice sent via Stripe')
      setAmount('')
      setDescription('')
      if (result.data.hostedInvoiceUrl) {
        window.open(result.data.hostedInvoiceUrl, '_blank', 'noopener,noreferrer')
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Connect your Stripe account to send invoices and collect payments from clients."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/integrations">CRM integrations</Link>
          </Button>
        }
      />

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#635BFF] to-[#7A6BFF] text-sm font-bold text-white">
              S
            </span>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Stripe</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {stripe.mode === 'platform'
                  ? 'Using platform Stripe keys from environment (development).'
                  : stripe.connected
                    ? 'Your workspace Stripe account is connected.'
                    : 'Connect Stripe to send invoices to clients.'}
              </p>
            </div>
          </div>
          {stripe.connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--success)]">
              <Check className="h-3 w-3" />
              Connected
            </span>
          ) : (
            <span className="rounded-full bg-[var(--bg-overlay)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
              Not connected
            </span>
          )}
        </div>

        {stripe.connected && stripe.mode === 'workspace' ? (
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setShowConnect((v) => !v)}
            >
              Update keys
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleDisconnect}
              className="text-[var(--text-tertiary)]"
            >
              <Unplug className="mr-1.5 h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        ) : null}

        {showConnect || !stripe.connected ? (
          <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="stripe-secret">Secret key</Label>
              <Input
                id="stripe-secret"
                type="password"
                placeholder="sk_live_... or sk_test_..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stripe-publishable">Publishable key (optional)</Label>
              <Input
                id="stripe-publishable"
                type="text"
                placeholder="pk_live_..."
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="button" disabled={isPending || !secretKey} onClick={handleConnect}>
              {isPending ? 'Connecting…' : 'Connect Stripe'}
            </Button>
            <p className="text-xs text-[var(--text-tertiary)]">
              Keys are stored encrypted per workspace. Get them from{' '}
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--brand-accent)] hover:underline"
              >
                Stripe Dashboard → API keys
              </a>
              .
            </p>
          </div>
        ) : null}
      </section>

      {stripe.connected ? (
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--brand-accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">New invoice</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Stripe emails your client a hosted invoice. They need an email on file.
          </p>

          {targets.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-tertiary)]">
              Add a client with a project first — invoices are tied to a record.{' '}
              <Link href="/admin/records" className="text-[var(--brand-accent)] hover:underline">
                Go to records
              </Link>
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Client & project</Label>
                <Select value={targetKey} onValueChange={setTargetKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client and project" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((t) => (
                      <SelectItem
                        key={`${t.contactId}:${t.recordId}`}
                        value={`${t.contactId}:${t.recordId}`}
                      >
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-amount">Amount (USD)</Label>
                <Input
                  id="invoice-amount"
                  type="number"
                  min="0.5"
                  step="0.01"
                  placeholder="150.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-desc">Description</Label>
                <Input
                  id="invoice-desc"
                  placeholder="HVAC service — March"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={handleCreateInvoice}
                  className="bg-[var(--brand-accent)] text-[var(--text-inverse)] hover:bg-[var(--brand-accent-hover)]"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isPending ? 'Sending…' : 'Send invoice'}
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent invoices</h2>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] px-6 py-10 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">No invoices yet</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Connect Stripe and send your first invoice above.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-2.5">Client</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Due</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="bg-[var(--bg-surface)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{inv.contactName}</p>
                      {inv.recordTitle ? (
                        <p className="text-xs text-[var(--text-tertiary)]">{inv.recordTitle}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {formatUsdFromCents(inv.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={invoiceLabel(inv.status)} tone={invoiceTone(inv.status)} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {inv.dueAt
                        ? inv.dueAt.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.paymentLinkUrl ? (
                        <a
                          href={inv.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium',
                            'text-[var(--brand-accent)] hover:underline',
                          )}
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
