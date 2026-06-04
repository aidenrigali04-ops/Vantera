'use client'

import { FeatureGate } from '@/lib/feature-flags/gate-client'
import { resolveHubForPath, type AdminNavHubLink } from '@/lib/navigation/admin-nav'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function RelatedPill({ link, active }: { link: AdminNavHubLink; active: boolean }) {
  const pill = (
    <Link
      href={link.href}
      data-tour={link.tourAnchor}
      className={
        active
          ? 'rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white'
          : 'rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900'
      }
    >
      {link.label}
    </Link>
  )

  if (link.flag) {
    return <FeatureGate flag={link.flag}>{pill}</FeatureGate>
  }

  return pill
}

/** Slim contextual links when viewing a hub area outside the dashboard. */
export function HubRelatedStrip() {
  const pathname = usePathname() ?? ''
  const hub = resolveHubForPath(pathname)

  if (!hub || pathname.startsWith('/admin/dashboard')) return null

  const links = hub.related
  const onPrimary =
    pathname === hub.primary.href || pathname.startsWith(`${hub.primary.href}/`)

  return (
    <div className="border-b border-stone-200/80 bg-stone-50/70 px-4 py-2 md:px-8">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
          {hub.title}
        </span>
        <span className="text-stone-300" aria-hidden>
          ·
        </span>
        {!hub.sidebarId || !onPrimary ? (
          <RelatedPill link={hub.primary} active={onPrimary} />
        ) : null}
        {links.length > 0 ? (
          <>
            <span className="text-[11px] text-stone-400">
              {!hub.sidebarId || !onPrimary ? 'Also' : 'Also here'}
            </span>
            {links.map((link) => (
              <RelatedPill
                key={link.id}
                link={link}
                active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
              />
            ))}
          </>
        ) : null}
      </div>
    </div>
  )
}
