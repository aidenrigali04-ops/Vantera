import Link from 'next/link'

export function AuthLegalNotice() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-[var(--text-tertiary)]">
      By continuing, you agree to Vantera&rsquo;s{' '}
      <Link
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--text-secondary)] underline-offset-2 transition-colors duration-150 hover:text-[var(--text-primary)] hover:underline"
      >
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--text-secondary)] underline-offset-2 transition-colors duration-150 hover:text-[var(--text-primary)] hover:underline"
      >
        Privacy Policy
      </Link>
      .
    </p>
  )
}
