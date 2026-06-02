'use client'

import { Button } from '@/components/ui/button'
import {
  AUTH_CALLBACK_PATH,
  AUTH_DASHBOARD_PATH,
  AUTH_LOGIN_PATH,
  AUTH_ONBOARDING_PATH,
  AUTH_SIGNUP_PATH,
  type AuthIntent,
} from '@/lib/auth/routes'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

type Provider = 'google' | 'apple'

type OAuthButtonsProps = {
  /** signup → new users land on onboarding; login → existing workspace dashboard */
  intent?: AuthIntent
  className?: string
  disabled?: boolean
}

const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
}

const PROVIDER_ERRORS: Record<Provider, string> = {
  google: 'Google sign-in failed. Try again.',
  apple: 'Apple sign-in failed. Try again.',
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    return /failed to fetch|network|load failed/i.test(err.message)
  }
  return false
}

/**
 * Google + Apple OAuth entry points.
 * Callback exchanges the code, then routes new users to complete-signup → onboarding,
 * or existing users straight to the dashboard.
 */
export function OAuthButtons({ intent = 'signup', className, disabled = false }: OAuthButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null)
  const [errors, setErrors] = useState<Partial<Record<Provider, string>>>({})
  const isDisabled = disabled || pending !== null

  async function go(provider: Provider) {
    setPending(provider)
    setErrors((prev) => ({ ...prev, [provider]: undefined }))

    try {
      const supabase = createSupabaseBrowserClient()
      const callback = new URL(AUTH_CALLBACK_PATH, window.location.origin)
      const destination = intent === 'signup' ? AUTH_ONBOARDING_PATH : AUTH_DASHBOARD_PATH
      callback.searchParams.set('next', destination)
      callback.searchParams.set('intent', intent)
      callback.searchParams.set(
        'return_to',
        intent === 'signup' ? AUTH_SIGNUP_PATH : AUTH_LOGIN_PATH,
      )

      const { error: providerError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callback.toString(),
        },
      })

      if (providerError) {
        setErrors((prev) => ({
          ...prev,
          [provider]: PROVIDER_ERRORS[provider],
        }))
        setPending(null)
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [provider]: isNetworkFailure(err)
          ? 'Connection issue. Check your internet and try again.'
          : PROVIDER_ERRORS[provider],
      }))
      setPending(null)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {(Object.keys(PROVIDER_LABELS) as Provider[]).map((provider) => (
        <div key={provider} className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-11 w-full justify-start gap-3 rounded-lg border-stone-200 bg-white px-4',
              'text-[15px] font-medium text-stone-800 shadow-sm',
              'transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900',
              'focus-visible:ring-2 focus-visible:ring-stone-900/10 focus-visible:ring-offset-2',
            )}
            onClick={() => go(provider)}
            disabled={isDisabled}
            aria-busy={pending === provider}
          >
            {provider === 'google' ? <GoogleIcon /> : <AppleIcon />}
            <span className="flex-1 text-left">
              {pending === provider ? 'Redirecting…' : PROVIDER_LABELS[provider]}
            </span>
            {pending === provider ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-stone-400" aria-hidden />
            ) : null}
          </Button>
          {errors[provider] ? (
            <p className="text-[13px] text-red-600" role="alert">
              {errors[provider]}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      className="size-[18px] shrink-0"
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

function AppleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  )
}
