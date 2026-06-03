'use client'

import { useBranding } from '@/lib/branding/context'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type TenantBrandMarkProps = {
  className?: string
  /** Link target — omit for non-interactive header marks. */
  href?: string
  size?: 'sm' | 'md'
}

function businessInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

/**
 * Workspace logo + name for client-facing surfaces (portal login, portal shell).
 */
export function TenantBrandMark({ className, href, size = 'md' }: TenantBrandMarkProps) {
  const { businessName, logoUrl, primaryColor } = useBranding()
  const label = businessName.trim() || 'Your workspace'
  const markSize = size === 'sm' ? 'size-7 text-[12px]' : 'size-8 text-[14px]'
  const nameClass = size === 'sm' ? 'text-[15px]' : 'text-[17px]'

  const content = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className={cn('h-8 w-auto max-w-[120px] shrink-0 object-contain', size === 'sm' && 'h-7 max-w-[100px]')}
        />
      ) : (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-[var(--radius-md)] font-bold tracking-tight text-white',
            markSize,
          )}
          style={{ backgroundColor: primaryColor }}
          aria-hidden
        >
          {businessInitial(label)}
        </span>
      )}
      <span className={cn('font-semibold tracking-[-0.02em] text-[var(--text-primary)]', nameClass)}>
        {label}
      </span>
    </>
  )

  const shellClass = cn('inline-flex min-w-0 items-center gap-2.5', className)

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          shellClass,
          'transition-opacity duration-150 hover:opacity-80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2',
        )}
      >
        {content}
      </Link>
    )
  }

  return <div className={shellClass}>{content}</div>
}
