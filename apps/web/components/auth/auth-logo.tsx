import Link from 'next/link'
import { cn } from '@/lib/utils'

type AuthLogoProps = {
  className?: string
}

/** Small Ventaro wordmark — top-left of auth column, links to landing. */
export function AuthLogo({ className }: AuthLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-block text-[17px] font-semibold tracking-[-0.02em] text-stone-900',
        'transition-colors duration-150 hover:text-stone-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/15 focus-visible:ring-offset-2',
        className,
      )}
    >
      Ventaro
    </Link>
  )
}
