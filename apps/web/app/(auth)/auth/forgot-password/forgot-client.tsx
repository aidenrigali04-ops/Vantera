'use client'

import { AuthInput, AuthFieldError, AuthFieldLabel } from '@/components/auth/auth-input'
import { GlobalErrorCallout } from '@/components/auth/global-error-callout'
import { Button } from '@/components/ui/button'
import { AUTH_LOGIN_ENTRY } from '@/lib/auth/routes'
import { useAuthFormBehavior } from '@/lib/auth/use-auth-form-behavior'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
})

export function ForgotPasswordClient() {
  const formRef = useRef<HTMLFormElement>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { email: '' },
  })

  useAuthFormBehavior(formRef, { initialFocusId: 'forgot-page-email', focusKey: 'forgot' })

  async function handleSubmit(values: z.infer<typeof schema>) {
    setGlobalError(null)
    setIsSubmitting(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectTo = new URL('/auth/reset-password', window.location.origin).toString()

      // Avoid email enumeration — always show the same success message.
      await supabase.auth.resetPasswordForEmail(values.email, { redirectTo })
      setSubmittedEmail(values.email)
    } catch (err) {
      setGlobalError(
        err instanceof TypeError
          ? 'Connection issue. Check your internet and try again.'
          : 'Could not send reset link. Try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedEmail) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-stone-900">Check your inbox</h1>
          <p className="text-[13px] leading-relaxed text-stone-500">
            If an account exists for that email, we sent a link you can use to set a new password.
            The link expires in 1 hour.
          </p>
        </div>

        <div
          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-[13px] leading-relaxed text-stone-700"
          role="status"
        >
          Check your inbox. We sent a reset link to{' '}
          <span className="font-medium text-stone-900">{submittedEmail}</span>.
        </div>

        <Link
          href={AUTH_LOGIN_ENTRY}
          className="inline-block text-[13px] font-medium text-stone-900 underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-stone-900">Reset your password</h1>
        <p className="text-[13px] leading-relaxed text-stone-500">
          Enter the email associated with your account and we&rsquo;ll send you a link to set a new
          password.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        noValidate
        aria-busy={isSubmitting}
      >
        <div className="space-y-1.5">
          <AuthFieldLabel htmlFor="forgot-page-email">Business email</AuthFieldLabel>
          <AuthInput
            id="forgot-page-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="send"
            placeholder="alex@acmeagency.com"
            disabled={isSubmitting}
            invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
          <AuthFieldError message={form.formState.errors.email?.message} />
        </div>

        {globalError ? <GlobalErrorCallout message={globalError} /> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>

      <p className="text-center text-[13px] text-stone-500">
        Remembered it?{' '}
        <Link
          href={AUTH_LOGIN_ENTRY}
          className="font-medium text-stone-900 underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
