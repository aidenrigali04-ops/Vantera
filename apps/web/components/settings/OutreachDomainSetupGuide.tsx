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
      title: 'Use your website domain',
      body: (
        <>
          Enter the same domain as your website — for example{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">{exampleDomain}</code>, not a
          different name. Outreach will send as{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            {exampleLocal}@{exampleDomain}
          </code>
          .
        </>
      ),
    },
    {
      title: 'Save domain in Vantera',
      body: (
        <>
          Click <strong>Save domain</strong> on this page. Vantera creates your DNS list in the two
          tables below (sending + replies). Use the copy buttons — you do not need a separate email
          provider account.
        </>
      ),
    },
    {
      title: 'Paste DNS where your website lives',
      body: (
        <>
          Open the same place you manage DNS for your website — Vercel, GoDaddy, Cloudflare,
          Squarespace, Namecheap, etc. Add each row from Vantera (type, host, value). That is the
          only step outside Vantera.
        </>
      ),
    },
    {
      title: 'Wait, then verify',
      body: (
        <>
          DNS usually updates in <strong>15–60 minutes</strong> (sometimes up to a few hours). Come
          back here and click <strong>Check verification</strong>. When status shows{' '}
          <strong>Verified</strong>, email outreach is ready. Use <strong>Refresh DNS status</strong>{' '}
          while you wait.
        </>
      ),
    },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50/80 px-4 py-3 text-left transition-colors hover:bg-stone-50">
        <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
          <BookOpen className="h-4 w-4 text-violet-600" />
          How to set up email on your domain
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-stone-500 transition-transform', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="space-y-4 rounded-lg border border-violet-200/60 bg-violet-50/50 p-4">
          <p className="text-sm font-medium text-stone-900">In short</p>
          <p className="text-sm leading-relaxed text-stone-700">
            Use the <strong>same domain as your website</strong>. Save it here in Vantera Settings,
            then paste the DNS records into wherever you already manage DNS for that domain (where
            you would add a website or subdomain record).
          </p>
        </div>

        <div className="mt-4 space-y-4 rounded-lg border border-stone-100 bg-white p-4">
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
                <strong>Next:</strong> Enter your website domain and click Save domain.
              </>
            ) : domainStatus === 'verified' && inboundDomainStatus === 'verified' ? (
              <>
                <strong>Done.</strong> Your domain is set up for sending and reply tracking.
              </>
            ) : domainStatus === 'verified' ? (
              <>
                <strong>Almost done:</strong> Sending works. Add the inbound (reply) DNS rows, then
                check verification again.
              </>
            ) : domainStatus === 'pending' ? (
              <>
                <strong>Pending DNS</strong> — normal for up to an hour. If records are pasted
                correctly at your DNS host, click Check verification again in 15–30 minutes.
              </>
            ) : (
              <>
                <strong>Next:</strong> Paste the DNS tables below at your DNS host, then click Check
                verification.
              </>
            )}
          </div>

          {hasDnsRecords && domainStatus !== 'verified' ? (
            <p className="text-[12px] text-stone-500">
              Replies use{' '}
              <code className="rounded bg-stone-100 px-1 text-[11px]">
                replies+@{'{id}'}@{exampleInbound}
              </code>{' '}
              after inbound DNS is verified.
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
