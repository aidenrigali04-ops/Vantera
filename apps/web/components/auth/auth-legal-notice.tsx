import Link from 'next/link'

export function AuthLegalNotice() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-stone-500">
      By continuing, you agree to Vantera&rsquo;s{' '}
      <Link
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-stone-700 underline-offset-2 hover:underline"
      >
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-stone-700 underline-offset-2 hover:underline"
      >
        Privacy Policy
      </Link>
      .
    </p>
  )
}
