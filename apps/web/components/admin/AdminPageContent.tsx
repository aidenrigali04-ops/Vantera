import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type AdminPageContentProps = ComponentPropsWithoutRef<'div'> & {
  /** Narrow form pages (scout configure, etc.) */
  narrow?: boolean
}

/** Standard vertical rhythm + padding for full-bleed admin routes. */
export function AdminPageContent({
  children,
  className,
  narrow,
  ...rest
}: AdminPageContentProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full space-y-6 px-4 py-5 md:px-8 md:py-6',
        narrow ? 'max-w-4xl' : 'max-w-[1280px]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

type AdminSubNavRailProps = {
  children: ReactNode
  className?: string
  /**
   * shell — aligns with full-bleed page content (own horizontal padding).
   * inset — sits inside WorkspaceMain padding (campaigns, clients, settings).
   */
  variant?: 'shell' | 'inset'
}

export function AdminSubNavRail({ children, className, variant = 'shell' }: AdminSubNavRailProps) {
  return (
    <div
      className={cn(
        'border-b border-[var(--border-default)]',
        variant === 'shell' && 'mx-auto w-full max-w-[1280px] px-4 md:px-8',
        variant === 'inset' && 'mb-6 w-full',
        className,
      )}
    >
      {children}
    </div>
  )
}
