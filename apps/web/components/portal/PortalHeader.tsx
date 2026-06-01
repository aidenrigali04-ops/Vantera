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
        'border-b border-stone-200/90 bg-white/95 backdrop-blur-sm',
        preview && 'rounded-t-xl',
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
            Client portal
          </p>
          <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-stone-900">
            {branding.businessName}
          </h1>
          {contactName ? (
            <p className="mt-0.5 text-[13px] text-stone-500">Welcome back, {contactName}</p>
          ) : null}
        </div>
        {!preview ? (
          <form action={portalLogoutAction}>
            <Button type="submit" variant="outline" size="sm" className="shrink-0">
              Sign out
            </Button>
          </form>
        ) : (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-600">
            Preview
          </span>
        )}
      </div>
    </header>
  )
}
