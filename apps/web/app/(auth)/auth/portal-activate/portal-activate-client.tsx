'use client'

import { AuthFieldError, AuthFieldLabel } from '@/components/auth/auth-input'
import { GlobalErrorCallout } from '@/components/auth/global-error-callout'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import { invokeAuthAction, isNextRedirectError } from '@/lib/auth/invoke-action'
import { signupFormSchema, type SignupFormValues } from '@/lib/auth/form-schemas'
import { activatePortalAccountAction } from '@/lib/portal/portal-auth-actions'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const activateFormSchema = signupFormSchema.pick({ password: true })

type ActivateFormValues = z.infer<typeof activateFormSchema>

type PortalActivateClientProps = {
  token: string
  preview: {
    email: string
    accountName: string
    hasExistingAccount: boolean
  } | null
  previewError: string | null
}

export function PortalActivateClient({
  token,
  preview,
  previewError,
}: PortalActivateClientProps) {
  const redirectingRef = useRef(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ActivateFormValues>({
    resolver: zodResolver(activateFormSchema),
    mode: 'onBlur',
    defaultValues: { password: '' },
  })

  const title = preview?.hasExistingAccount
    ? 'Set a new portal password'
    : 'Create your portal account'
  const subtitle = preview
    ? preview.hasExistingAccount
      ? `${preview.accountName} sent you a new link. Choose a password for ${preview.email} — this is only for your client portal, not the Vantera dashboard.`
      : `${preview.accountName} invited you. Choose a password for ${preview.email} to access your client portal.`
    : 'Use the link from your invite email to set your password.'

  async function handleSubmit(values: ActivateFormValues) {
    if (!token || redirectingRef.current) return

    setIsSubmitting(true)
    setGlobalError(null)

    try {
      const result = await invokeAuthAction(
        () => activatePortalAccountAction({ token, password: values.password }),
        '/portal',
      )

      if (!result.success) {
        setGlobalError(result.error ?? 'Could not activate your account. Try again.')
        setIsSubmitting(false)
        return
      }

      if (result.redirectTo) {
        redirectingRef.current = true
        window.location.replace(result.redirectTo)
        return
      }
    } catch (err) {
      if (isNextRedirectError(err)) throw err
      setGlobalError('Something went wrong. Please try again.')
    }

    setIsSubmitting(false)
  }

  if (previewError && !preview) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Invite link unavailable
          </h1>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{previewError}</p>
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/auth/portal-login">Go to portal sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
      </div>

      {preview ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
          Email: <span className="font-medium text-[var(--text-primary)]">{preview.email}</span>
        </div>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {globalError ? <GlobalErrorCallout message={globalError} className="mb-0" /> : null}
      </div>

      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        noValidate
        aria-busy={isSubmitting}
      >
        <div className="space-y-1.5">
          <AuthFieldLabel htmlFor="portal-activate-password">Password</AuthFieldLabel>
          <PasswordField
            id="portal-activate-password"
            value={form.watch('password')}
            onChange={(value) => form.setValue('password', value)}
            onBlur={() => void form.trigger('password')}
            autoComplete="new-password"
            enterKeyHint="done"
            disabled={isSubmitting}
            aria-invalid={Boolean(form.formState.errors.password)}
          />
          <AuthFieldError message={form.formState.errors.password?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Create portal account'
          )}
        </Button>
      </form>

      <p className="text-center text-[13px] text-[var(--text-secondary)]">
        Already set your password?{' '}
        <Link
          href="/auth/portal-login"
          className="font-medium text-[var(--text-primary)] underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
