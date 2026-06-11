'use client'

import { AuthFieldError, AuthFieldLabel } from '@/components/auth/auth-input'
import { GlobalErrorCallout } from '@/components/auth/global-error-callout'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { AUTH_LOGIN_ENTRY } from '@/lib/auth/routes'
import { useAuthFormBehavior } from '@/lib/auth/use-auth-form-behavior'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/\d/, 'Password must include at least one number'),
    confirm: z.string().min(8, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

export function ResetPasswordClient() {
  const formRef = useRef<HTMLFormElement>(null)
  const [ready, setReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { password: '', confirm: '' },
  })

  useAuthFormBehavior(formRef, {
    initialFocusId: ready ? 'reset-password' : undefined,
    focusKey: ready ? 'reset-ready' : 'reset-waiting',
  })

  // Supabase puts the recovery session in the URL hash on arrival.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let cancelled = false

    async function check() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        setReady(true)
      } else {
        setSessionError('This reset link is invalid or has expired. Request a new one below.')
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(values: z.infer<typeof schema>) {
    setGlobalError(null)
    setIsSubmitting(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: values.password })

      if (updateError) {
        setGlobalError(updateError.message)
        setIsSubmitting(false)
        return
      }

      setDone(true)
    } catch (err) {
      setGlobalError(
        err instanceof TypeError
          ? 'Connection issue. Check your internet and try again.'
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-[24px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">Password updated</h1>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            You can now sign in with your new password.
          </p>
        </div>
        <Link
          href={AUTH_LOGIN_ENTRY}
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors duration-150 hover:bg-[var(--accent-hover)]"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-[24px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">Choose a new password</h1>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Use at least 8 characters with one number — something you&rsquo;ll remember.
        </p>
      </div>

      {sessionError ? <GlobalErrorCallout message={sessionError} /> : null}

      <form
        ref={formRef}
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        noValidate
        aria-busy={isSubmitting}
      >
        <div className="space-y-1.5">
          <AuthFieldLabel htmlFor="reset-password">New password</AuthFieldLabel>
          <PasswordField
            id="reset-password"
            value={form.watch('password')}
            onChange={(value) => form.setValue('password', value, { shouldValidate: false })}
            onBlur={() => void form.trigger('password')}
            autoComplete="new-password"
            enterKeyHint="next"
            placeholder="••••••••"
            showStrength
            disabled={!ready || isSubmitting}
            aria-invalid={Boolean(form.formState.errors.password)}
          />
          <AuthFieldError message={form.formState.errors.password?.message} />
        </div>

        <div className="space-y-1.5">
          <AuthFieldLabel htmlFor="reset-confirm">Confirm password</AuthFieldLabel>
          <PasswordField
            id="reset-confirm"
            value={form.watch('confirm')}
            onChange={(value) => form.setValue('confirm', value, { shouldValidate: false })}
            onBlur={() => void form.trigger('confirm')}
            autoComplete="new-password"
            enterKeyHint="go"
            placeholder="••••••••"
            disabled={!ready || isSubmitting}
            aria-invalid={Boolean(form.formState.errors.confirm)}
          />
          <AuthFieldError message={form.formState.errors.confirm?.message} />
        </div>

        {globalError ? <GlobalErrorCallout message={globalError} /> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-[var(--radius-lg)] border-0 bg-[var(--accent)] font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
          disabled={!ready || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </form>

      {!ready ? (
        <p className="text-center text-[13px] text-[var(--text-tertiary)]">
          <Link
            href="/auth/forgot-password"
            className="font-medium text-[var(--accent)] underline-offset-2 transition-colors duration-150 hover:text-[var(--accent-hover)] hover:underline"
          >
            Request a new reset link
          </Link>
        </p>
      ) : null}
    </div>
  )
}
