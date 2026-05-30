import Link from 'next/link'

type AuthLogoProps = {
  className?: string
}

/** Small wordmark — top-left of auth column, links to landing. */
export function AuthLogo({ className }: AuthLogoProps) {
  return (
    <Link
      href="/"
      className={`inline-block text-lg font-semibold tracking-tight text-stone-900 hover:text-stone-700 ${className ?? ''}`}
    >
      Vantera
    </Link>
  )
}
