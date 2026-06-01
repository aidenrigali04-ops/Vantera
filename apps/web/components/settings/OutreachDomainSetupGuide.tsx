'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { BookOpen, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type Props = {
  fromDomain: string
  inboundDomain: string
  fromLocalPart: string
  previewFrom: string
  previewReplyDomain: string
  domainStatus: string
  inboundDomainStatus: string
  hasDnsRecords: boolean
}

type GuideStep = {
  title: string
  body: ReactNode
}

export function OutreachDomainSetupGuide({
  fromDomain,
  inboundDomain,
  fromLocalPart,
  previewFrom,
  previewReplyDomain,
  domainStatus,
  inboundDomainStatus,
  hasDnsRecords,
}: Props) {
  const exampleDomain = fromDomain.trim() || 'yourcompany.com'
  const exampleInbound = inboundDomain.trim() || `inbound.${exampleDomain}`
  const exampleLocal = fromLocalPart.trim() || 'outreach'
  const [open, setOpen] = useState(domainStatus !== 'verified')

  const steps: GuideStep[] = [
    {
      title: 'Enter your domain in Ventaro',
      body: (
        <>
          Sending domain:{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">{exampleDomain}</code>.
          Emails will send as{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            {exampleLocal}@{exampleDomain}
          </code>
          . Ventaro registers everything with our email provider — you never need a Resend login.
        </>
      ),
    },
    {
      title: 'Click Save domain',
      body: (
        <>
          Ventaro generates your DNS records instantly in the two tables below — one for sending,
          one for inbound replies. Each row has copy buttons for the host and value.
        </>
      ),
    },
    {
      title: 'Paste records at your DNS host (only step outside Ventaro)',
      body: (
        <>
          Open wherever you manage DNS — Cloudflare, GoDaddy, Namecheap, Google Domains, etc. Paste
          the records from Ventaro. This takes about 5 minutes. DNS propagation can take up to 48
          hours, but is often much faster.
        </>
      ),
    },
    {
      title: 'Return here and click Check verification',
      body: (
        <>
          Ventaro checks DNS for you — no third-party dashboard. When <strong>Send</strong> shows
          Verified, campaigns use{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">{previewFrom}</code>. When{' '}
          <strong>Replies</strong> shows Verified, replies to{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            replies+{'{id}'}@{exampleInbound}
          </code>{' '}
          are tracked on your campaign automatically.
        </>
      ),
    },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50/80 px-4 py-3 text-left transition-colors hover:bg-stone-50">
        <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
          <BookOpen className="h-4 w-4 text-violet-600" />
          Setup guide — stay in Ventaro
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-stone-500 transition-transform', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="space-y-4 rounded-lg border border-stone-100 bg-white p-4">
          <p className="text-sm text-stone-600">
            You only leave Ventaro once — to paste DNS records at your domain provider. Everything
            else (registration, verification, reply routing) happens inside this page.
          </p>

          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">{step.title}</p>
                  <div className="mt-1 text-sm leading-relaxed text-stone-600">{step.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-900">
            {!hasDnsRecords ? (
              <>
                <strong>Start:</strong> Enter your domain and click Save domain.
              </>
            ) : domainStatus === 'verified' && inboundDomainStatus === 'verified' ? (
              <>
                <strong>All set.</strong> Sending and reply tracking are active.
              </>
            ) : domainStatus === 'verified' ? (
              <>
                <strong>Almost there:</strong> Sending works. Add the inbound MX records and verify
                replies.
              </>
            ) : (
              <>
                <strong>Next:</strong> Paste the DNS records below, then click Check verification.
                Use Refresh DNS status to update row statuses without leaving Ventaro.
              </>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
