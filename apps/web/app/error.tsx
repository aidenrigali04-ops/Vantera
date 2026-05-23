'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Show the real error in Vercel function logs.
    console.error('[root] render error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        fontFamily: 'system-ui, sans-serif',
        color: '#0f172a',
        background: '#fff',
      }}
    >
      <div style={{ maxWidth: 640, textAlign: 'center', width: '100%' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: '#475569', margin: '0 0 16px' }}>
          We hit an unexpected error rendering this page. The full message is below.
        </p>

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
            margin: '0 0 16px',
          }}
        >
          {error.message || 'Unknown error'}
          {error.digest ? `\n\nDigest: ${error.digest}` : ''}
        </pre>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button
            onClick={reset}
            style={{
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
          <button
            onClick={() => (window.location.href = '/auth/login')}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#0f172a',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}
