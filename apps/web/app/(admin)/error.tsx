'use client'

import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin] render error:', error)
  }, [error])

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We hit an error rendering this page. The team has been notified.
        </p>

        {isDev || error.message ? (
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-left text-xs">
            {error.message || 'Unknown error'}
            {error.digest ? `\n\nDigest: ${error.digest}` : ''}
          </pre>
        ) : error.digest ? (
          <p className="text-xs text-muted-foreground">
            Digest: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}

        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button onClick={() => (window.location.href = '/auth/login')} variant="outline">
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  )
}
