'use client'

import { DnsRecordsTable } from '@/components/settings/DnsRecordsTable'
import { OutreachDomainSetupGuide } from '@/components/settings/OutreachDomainSetupGuide'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OutreachDomainSettings } from '@/lib/settings/outreach-domain-actions'
import {
  clearOutreachDomain,
  refreshOutreachDomainDns,
  saveOutreachDomain,
  verifyOutreachDomain,
} from '@/lib/settings/outreach-domain-actions'
import { cn } from '@/lib/utils'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initial: OutreachDomainSettings
  /** Called after save / verify / refresh so parent views can reload hub stats */
  onSaved?: () => void
  /** Use operational design tokens (e.g. on Email outreach page) */
  embedded?: boolean
}

function statusLabel(status: string): string {
  switch (status) {
    case 'verified':
      return 'Verified'
    case 'pending':
      return 'Pending DNS'
    case 'failed':
      return 'Verification failed'
    default:
      return 'Platform default'
  }
}

function statusTone(status: string): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
    case 'pending':
      return 'bg-amber-50 text-amber-800 ring-amber-200/80'
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-200/80'
    default:
      return 'bg-stone-100 text-stone-600 ring-stone-200/80'
  }
}

export function OutreachDomainSettingsPanel({ initial, onSaved, embedded = false }: Props) {
  const router = useRouter()
  const [settings, setSettings] = useState(initial)
  const [fromDomain, setFromDomain] = useState(initial.fromDomain ?? '')
  const [inboundDomain, setInboundDomain] = useState(initial.inboundDomain ?? '')
  const [fromLocalPart, setFromLocalPart] = useState(initial.fromLocalPart)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSettings(initial)
    setFromDomain(initial.fromDomain ?? '')
    setInboundDomain(initial.inboundDomain ?? '')
    setFromLocalPart(initial.fromLocalPart)
  }, [initial])

  function handleSave() {
    startTransition(async () => {
      const result = await saveOutreachDomain({
        fromDomain,
        inboundDomain: inboundDomain || undefined,
        fromLocalPart,
      })
      if (!result.success) {
        toast.error('error' in result ? result.error : 'Could not save domain')
        return
      }
      if (!result.data) {
        toast.error('Domain saved but settings could not be reloaded')
        return
      }

      let next = result.data
      if (next.sendingRecords.length === 0 && next.fromDomain) {
        const refreshed = await refreshOutreachDomainDns()
        if (refreshed.success && refreshed.data) {
          next = refreshed.data
        }
      }

      setSettings(next)
      setFromDomain(next.fromDomain ?? '')
      setInboundDomain(next.inboundDomain ?? '')

      if (next.sendingRecords.length > 0) {
        toast.success('Domain saved — copy the DNS records below into your DNS host')
      } else {
        toast.message(
          'Domain saved, but DNS records are not available yet. Click Refresh DNS status in a moment.',
          { duration: 6000 },
        )
      }

      if (next.inboundSetupWarning) {
        toast.warning(next.inboundSetupWarning, { duration: 8000 })
      }

      router.refresh()
      onSaved?.()
    })
  }

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshOutreachDomainDns()
      if (!result.success) {
        toast.error('error' in result ? result.error : 'Could not refresh DNS')
        return
      }
      if (!result.data) {
        toast.error('DNS refreshed but settings could not be reloaded')
        return
      }
      setSettings(result.data)
      toast.success(
        result.data.sendingRecords.length > 0
          ? 'DNS record status updated'
          : 'Refreshed — records still pending from Resend. Try again shortly.',
      )
      router.refresh()
      onSaved?.()
    })
  }

  function handleVerify() {
    startTransition(async () => {
      const result = await verifyOutreachDomain()
      if (!result.success) {
        toast.error('error' in result ? result.error : 'Verification failed')
        return
      }
      if (!result.data) {
        toast.error('Verification ran but settings could not be reloaded')
        return
      }
      setSettings(result.data)
      const sendingOk = result.data.domainStatus === 'verified'
      const inboundOk = result.data.inboundDomainStatus === 'verified'
      if (sendingOk && inboundOk) {
        toast.success('Sending and reply routing are verified')
      } else if (sendingOk) {
        toast.success('Sending verified — add inbound MX records to track replies')
      } else {
        toast.success('Checked — DNS may still be propagating. Try again in a few minutes.')
      }
      router.refresh()
      onSaved?.()
    })
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearOutreachDomain()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSettings({
        fromDomain: null,
        inboundDomain: null,
        fromLocalPart: 'outreach',
        domainStatus: 'not_configured',
        inboundDomainStatus: 'not_configured',
        sendingRecords: [],
        inboundRecords: [],
        dnsRecords: [],
        previewFrom: initial.previewFrom,
        previewReplyDomain: initial.previewReplyDomain,
        isCustomDomain: false,
      })
      setFromDomain('')
      setInboundDomain('')
      setFromLocalPart('outreach')
      toast.success('Using platform default domain for outreach')
      router.refresh()
      onSaved?.()
    })
  }

  const hasRecords = settings.sendingRecords.length > 0 || settings.inboundRecords.length > 0

  return (
    <section
      className={cn(
        'rounded-xl border p-5 sm:p-6',
        embedded
          ? 'card-surface border-[var(--border-subtle)]'
          : 'border-stone-200 bg-white shadow-sm',
      )}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className={cn(
              'text-base font-semibold',
              embedded ? 'text-[var(--text-primary)]' : 'text-stone-900',
            )}
          >
            Outreach email domain
          </h2>
          <p
            className={cn(
              'mt-0.5 text-[13px] leading-relaxed',
              embedded ? 'text-[var(--text-secondary)]' : 'text-stone-500',
            )}
          >
            Send outreach from your own domain (e.g. outreach@yourcompany.com). Use the same domain
            as your work email — save it here, then paste the DNS records where you manage that
            domain (Google Workspace, Microsoft 365, Cloudflare, etc.).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
              statusTone(settings.domainStatus),
            )}
          >
            Send: {statusLabel(settings.domainStatus)}
          </span>
          {settings.fromDomain ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                statusTone(settings.inboundDomainStatus),
              )}
            >
              Replies: {statusLabel(settings.inboundDomainStatus)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        <OutreachDomainSetupGuide
          fromDomain={fromDomain}
          inboundDomain={inboundDomain}
          fromLocalPart={fromLocalPart}
          domainStatus={settings.domainStatus}
          inboundDomainStatus={settings.inboundDomainStatus}
          hasDnsRecords={hasRecords}
        />

        <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-4 text-sm text-stone-600">
          <p>
            <span className="font-medium text-stone-800">Send as:</span> {settings.previewFrom}
          </p>
          <p className="mt-1">
            <span className="font-medium text-stone-800">Replies to:</span>{' '}
            replies+{'{step}'}@{settings.previewReplyDomain}
          </p>
          {settings.fromDomain && settings.domainStatus !== 'verified' ? (
            <p className="mt-2 text-[12px] text-amber-800">
              Outreach will use your platform default address until sending DNS is verified.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="outreach-from-domain">Your work email domain</Label>
            <Input
              id="outreach-from-domain"
              value={fromDomain}
              onChange={(event) => {
                setFromDomain(event.target.value)
                if (!inboundDomain || inboundDomain.startsWith('inbound.')) {
                  const next = event.target.value.trim().replace(/^https?:\/\//, '')
                  if (next.includes('.')) setInboundDomain(`inbound.${next}`)
                }
              }}
              placeholder="yourcompany.com"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[12px] text-stone-500">
              Same domain as your work email — not a separate email-only domain.
            </p>
          </div>
          <div>
            <Label htmlFor="outreach-local-part">From address prefix</Label>
            <Input
              id="outreach-local-part"
              value={fromLocalPart}
              onChange={(event) => setFromLocalPart(event.target.value)}
              placeholder="outreach"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="outreach-inbound-domain">Inbound reply subdomain</Label>
          <Input
            id="outreach-inbound-domain"
            value={inboundDomain}
            onChange={(event) => setInboundDomain(event.target.value)}
            placeholder="inbound.acmehvac.com"
            className="mt-1.5 max-w-md"
          />
        </div>

        {settings.inboundSetupWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            <p className="font-medium">Inbound reply routing needs attention</p>
            <p className="mt-1">{settings.inboundSetupWarning}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={isPending || !fromDomain.trim()}>
            Save domain
          </Button>
          {settings.fromDomain ? (
            <>
              <Button variant="outline" onClick={handleRefresh} disabled={isPending}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh DNS status
              </Button>
              <Button variant="outline" onClick={handleVerify} disabled={isPending}>
                Check verification
              </Button>
            </>
          ) : null}
          {settings.isCustomDomain ? (
            <Button variant="ghost" onClick={handleClear} disabled={isPending}>
              Use platform default
            </Button>
          ) : null}
        </div>

        <DnsRecordsTable
          title="Step 1 — Paste these at your DNS host (sending)"
          description={`At Google Workspace, Microsoft 365, Cloudflare, or wherever ${fromDomain || 'your work email'} DNS lives. Copy each row exactly.`}
          records={settings.sendingRecords}
          emptyMessage="Enter your work email domain above and click Save domain — records will appear here."
        />

        <DnsRecordsTable
          title="Step 2 — Paste these at your DNS host (replies)"
          description={`Add on ${inboundDomain || 'inbound.yourdomain.com'} so replies are tracked automatically.`}
          records={settings.inboundRecords}
          emptyMessage={
            settings.fromDomain
              ? 'Save domain first, then click Refresh DNS status if inbound rows are missing.'
              : undefined
          }
        />

        {settings.fromDomain && settings.domainStatus === 'pending' ? (
          <p className="text-[13px] text-stone-600">
            Status <strong>Pending</strong> is normal for 15–60 minutes after you paste DNS. Click{' '}
            <strong>Refresh DNS status</strong>, then <strong>Check verification</strong>.
          </p>
        ) : null}

        {settings.domainStatus === 'verified' ? (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Sending is verified.{' '}
              {settings.inboundDomainStatus === 'verified'
                ? 'Replies are routed automatically.'
                : 'Add the inbound MX records above to enable automatic reply tracking.'}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
