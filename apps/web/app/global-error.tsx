'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global] render error:', error)
  }, [error])

  return (
    <html>
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          backgroundColor: '#fff',
          color: '#0f172a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '0 0 24px' }}>
            We hit an unexpected error. The team has been notified.
          </p>
          {error.message ? (
            <pre
              style={{
                textAlign: 'left',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
              {error.digest ? `\n\nDigest: ${error.digest}` : ''}
            </pre>
          ) : error.digest ? (
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Digest: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
