'use client'

import { FeatureGate } from '@/lib/feature-flags/gate-client'
import { getDashboardHubs, type AdminNavHub, type AdminNavHubLink } from '@/lib/navigation/admin-nav'
import { requestProductTourReplay } from '@/lib/onboarding/product-tour'
import { cn } from '@/lib/utils'
import { ArrowRight, PlayCircle } from 'lucide-react'
import Link from 'next/link'

function HubRelatedLink({ link }: { link: AdminNavHubLink }) {
  const content = (
    <Link
      href={link.href}
      data-tour={link.tourAnchor}
      className="inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
    >
      {link.label}
    </Link>
  )

  if (link.flag) {
    return <FeatureGate flag={link.flag}>{content}</FeatureGate>
  }

  return content
}

function HubCard({ hub }: { hub: AdminNavHub }) {
  const PrimaryIcon = hub.primary.icon
  const inSidebar = Boolean(hub.sidebarId)

  return (
    <article className="flex h-full flex-col rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
          <PrimaryIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-stone-900">{hub.title}</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-stone-500">{hub.description}</p>
        </div>
      </div>

      {!inSidebar ? (
        <Link
          href={hub.primary.href}
          data-tour={hub.primary.tourAnchor}
          className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-stone-800"
        >
          {hub.primary.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}

      {hub.related.length > 0 ? (
        <div className={cn('mt-3 flex flex-wrap gap-1', !inSidebar && 'mt-4 border-t border-stone-100 pt-3')}>
          {hub.related.map((link) => (
            <HubRelatedLink key={link.id} link={link} />
          ))}
        </div>
      ) : inSidebar ? (
        <p className="mt-3 text-[12px] text-stone-500">
          Open from the sidebar — section tabs where needed, or Settings for portal and billing.
        </p>
      ) : null}
    </article>
  )
}

/** Compact workspace map — related tools grouped by area instead of sidebar sprawl. */
export function DashboardWorkspaceHubs({ className }: { className?: string }) {
  const hubs = getDashboardHubs()

  return (
    <section className={cn('space-y-3', className)} aria-label="Workspace areas">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-900">Where to go next</h2>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Four areas in the sidebar — everything else lives inside these groups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => requestProductTourReplay()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]"
        >
          <PlayCircle className="h-3.5 w-3.5 text-[var(--brand-accent)]" aria-hidden />
          Slideshow tour
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {hubs.map((hub) => (
          <HubCard key={hub.id} hub={hub} />
        ))}
      </div>
    </section>
  )
}
