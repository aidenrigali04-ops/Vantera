'use client'

import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { useState } from 'react'

type Provider = 'google' | 'facebook'

type OAuthButtonsProps = {
  /** Path the user should land on after the OAuth code is exchanged. */
  next?: string
}

/**
 * OAuth sign-in / sign-up buttons.
 *
 * Both buttons trigger Supabase's `signInWithOAuth` and redirect the user
 * through the provider. After the provider redirects back, the
 * `/auth/callback` route handler exchanges the code for a session and
 * routes the user into either the dashboard (if they already have a
 * Vantera account) or the complete-signup page (if this is their first
 * time and we still need a business name).
 *
 * Providers must be enabled inside the Supabase Dashboard
 * (Authentication → Providers). The button is intentionally not
 * disabled when a provider is unconfigured — Supabase returns a clear
 * error which we surface in the inline error message below.
 */
export function OAuthButtons({ next }: OAuthButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function go(provider: Provider) {
    setPending(provider)
    setError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const callback = new URL('/auth/callback', window.location.origin)
      if (next) callback.searchParams.set('next', next)

      const { error: providerError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callback.toString(),
        },
      })

      if (providerError) {
        setError(providerError.message)
        setPending(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth failed to start')
      setPending(null)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2"
        onClick={() => go('google')}
        disabled={pending !== null}
      >
        <GoogleIcon />
        {pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2"
        onClick={() => go('facebook')}
        disabled={pending !== null}
      >
        <FacebookIcon />
        {pending === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.581C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path
        fill="#1877F2"
        d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
      />
    </svg>
  )
}
