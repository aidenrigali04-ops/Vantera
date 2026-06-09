import Link from 'next/link'
import { cn } from '@/lib/utils'

type AuthLogoProps = {
  className?: string
}

/** Vantera wordmark — top-left of auth column, links to signup entry. */
export function AuthLogo({ className }: AuthLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-2.5',
        'transition-opacity duration-150 hover:opacity-80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2',
        className,
      )}
    >
      <span
        className="icon-tile flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[14px] font-semibold tracking-tight text-[var(--text-secondary)]"
        aria-hidden
      >
        V
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Vantera
      </span>
    </Link>
  )
}
