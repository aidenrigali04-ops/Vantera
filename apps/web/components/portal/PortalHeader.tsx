'use client'

import { portalLogoutAction } from '@/lib/auth/actions'
import { useBranding } from '@/lib/branding/context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PortalHeaderProps = {
  contactName?: string
  preview?: boolean
  className?: string
}

export function PortalHeader({ contactName, preview = false, className }: PortalHeaderProps) {
  const branding = useBranding()

  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md',
        preview && 'rounded-t-xl',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6 sm:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Client portal
          </p>
          <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            {branding.businessName}
          </h1>
          {contactName ? (
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Welcome back, {contactName}
            </p>
          ) : null}
        </div>
        {!preview ? (
          <form action={portalLogoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="shrink-0 border-[var(--border-default)]"
            >
              Sign out
            </Button>
          </form>
        ) : (
          <span className="rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            Preview
          </span>
        )}
      </div>
    </header>
  )
}
