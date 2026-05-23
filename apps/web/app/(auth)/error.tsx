'use client'

import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[auth] render error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign-in is temporarily unavailable</h1>
        <p className="text-sm text-muted-foreground">
          We hit an unexpected error. Try again in a moment.
        </p>

        {error.message ? (
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-left text-xs">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ''}
          </pre>
        ) : error.digest ? (
          <p className="text-xs text-muted-foreground">
            Digest: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}

        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
