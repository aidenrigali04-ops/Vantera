'use client'

import { DashboardClientHealthPanel } from '@/components/dashboard/DashboardClientHealthPanel'
import { DashboardPipelineSnapshot } from '@/components/dashboard/DashboardPipelineSnapshot'
import { DashboardTeamWorkloadPanel } from '@/components/dashboard/DashboardTeamWorkloadPanel'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

type Props = {
  snapshot: DashboardSnapshot
  actionFeed: ActionFeedItem[]
  defaultOpen?: boolean
  showCleanSlate?: boolean
}

function OverviewBlock({
  title,
  subtitle,
  href,
  linkLabel,
  tourAnchor,
  children,
}: {
  title: string
  subtitle: string
  href: string
  linkLabel: string
  tourAnchor?: string
  children: ReactNode
}) {
  return (
    <section data-tour={tourAnchor} className="rounded-lg border border-stone-100 bg-stone-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-stone-900">{title}</h3>
          <p className="mt-0.5 text-[12px] text-stone-500">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="text-[12px] font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
        >
          {linkLabel}
        </Link>
      </div>
      {children}
    </section>
  )
}

/** Secondary dashboard panels — tucked away until the user wants the full picture. */
export function DashboardOverviewCollapsible({
  snapshot,
  actionFeed,
  defaultOpen = false,
  showCleanSlate = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-stone-50/60">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-900">
              Workspace overview
            </h2>
            <p className="mt-0.5 text-[13px] text-stone-500">
              Pipeline, client health, and delivery at a glance
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-stone-600">
            {open ? 'Hide' : 'Show'}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
              aria-hidden
            />
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-stone-100 p-5">
            <OverviewBlock
              title="Pipeline snapshot"
              subtitle="Open opportunities by stage"
              href="/admin/pipeline"
              linkLabel="View pipeline"
              tourAnchor="dashboard-pipeline"
            >
              <DashboardPipelineSnapshot deals={snapshot.deals} showCleanSlate={showCleanSlate} />
            </OverviewBlock>

            <div className="grid gap-4 lg:grid-cols-2">
              <OverviewBlock
                title="Client health"
                subtitle="Accounts that may need a check-in"
                href="/admin/clients"
                linkLabel="View contacts"
              >
                <DashboardClientHealthPanel clients={snapshot.clients} />
              </OverviewBlock>

              <OverviewBlock
                title="Team workload"
                subtitle="Overdue tasks and active delivery"
                href="/admin/pipeline"
                linkLabel="View tasks"
              >
                <DashboardTeamWorkloadPanel projects={snapshot.projects} actionFeed={actionFeed} />
              </OverviewBlock>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
