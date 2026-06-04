'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { BookOpen, ChevronDown } from 'lucide-react'
import { useState } from 'react'

type Props = {
  portalDomain: string
  domainStatus: string
  cnameTarget: string
  vercelAutoProvision: boolean
}

export function PortalDomainSetupGuide({
  portalDomain,
  domainStatus,
  cnameTarget,
  vercelAutoProvision,
}: Props) {
  const example = portalDomain.trim() || 'portal.yourcompany.com'
  const [open, setOpen] = useState(domainStatus !== 'verified')

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50/80 px-4 py-3 text-left text-sm font-medium text-stone-800',
        )}
      >
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-stone-500" />
          How white-label portal domains work
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-stone-500 transition-transform', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3 rounded-lg border border-stone-100 bg-white px-4 py-3 text-[13px] leading-relaxed text-stone-600">
        <p>
          Clients sign in at{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">{example}</code> with your logo
          and colors — no Vantera URL in the invite once DNS is verified.
        </p>
        <ol className="list-decimal space-y-2 pl-4">
          <li>
            Choose a subdomain you control (e.g.{' '}
            <code className="rounded bg-stone-100 px-1">portal.yourcompany.com</code>).
          </li>
          <li>
            Add the DNS records below at your DNS host (Cloudflare, GoDaddy, Google Domains, etc.).
            {vercelAutoProvision
              ? ' Vantera registers the hostname with Vercel automatically when you save.'
              : ' Also add the hostname under Vercel → Project → Domains if you host on Vercel.'}
          </li>
          <li>
            Default CNAME target:{' '}
            <code className="rounded bg-stone-100 px-1">{cnameTarget}</code>
          </li>
          <li>
            Click <strong>Check DNS &amp; activate</strong>. Invites switch to your domain when status
            is <strong>Verified</strong>.
          </li>
          <li>
            Client invites use a one-time setup link at{' '}
            <code className="break-all rounded bg-stone-100 px-1 text-xs">
              https://{example}/auth/portal-activate
            </code>
            — separate from your Vantera dashboard login.
          </li>
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}
