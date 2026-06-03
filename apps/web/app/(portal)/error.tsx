'use client'

import { TenantBrandMark } from '@/components/branding/tenant-brand-mark'
import { useBranding } from '@/lib/branding/context'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { businessName } = useBranding()

  useEffect(() => {
    console.error('[portal] render error:', error)
  }, [error])

  const isDev = process.env.NODE_ENV !== 'production'
  const provider = businessName.trim() || 'your provider'

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-base)]">
      <div className="border-b border-[var(--border-subtle)] px-6 py-4">
        <TenantBrandMark size="sm" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Something went wrong
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            We hit an error loading your {provider} portal. Please try again or sign in again.
          </p>

          {isDev || error.message ? (
            <pre className="overflow-x-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-left text-xs">
              {error.message || 'Unknown error'}
              {error.digest ? `\n\nDigest: ${error.digest}` : ''}
            </pre>
          ) : error.digest ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              Digest: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}

          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={reset} variant="default" style={{ backgroundColor: 'var(--brand-primary)' }}>
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = '/auth/portal-login')}
              variant="outline"
            >
              Sign in again
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
