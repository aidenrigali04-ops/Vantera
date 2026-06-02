import Link from 'next/link'
import { cn } from '@/lib/utils'

type AuthLogoProps = {
  className?: string
}

/** Ventaro wordmark — top-left of auth column, links to landing. */
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
        className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[14px] font-bold tracking-tight text-[var(--text-primary)]"
        aria-hidden
      >
        V
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Ventaro
      </span>
    </Link>
  )
}
