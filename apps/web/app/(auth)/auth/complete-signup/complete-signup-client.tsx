'use client'

import { AuthInput, AuthFieldError, AuthFieldLabel } from '@/components/auth/auth-input'
import { GlobalErrorCallout } from '@/components/auth/global-error-callout'
import { Button } from '@/components/ui/button'
import { completeOAuthSignupAction } from '@/lib/auth/actions'
import { invokeAuthAction, isNextRedirectError } from '@/lib/auth/invoke-action'
import { AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'
import { useAuthFormBehavior } from '@/lib/auth/use-auth-form-behavior'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const completeSignupSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name').max(120),
})

type CompleteSignupClientProps = {
  prefilledEmail: string
  prefilledName: string
}

export function CompleteSignupClient({
  prefilledEmail,
  prefilledName,
}: CompleteSignupClientProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const redirectingRef = useRef(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof completeSignupSchema>>({
    resolver: zodResolver(completeSignupSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { fullName: prefilledName },
  })

  useAuthFormBehavior(formRef, { initialFocusId: 'oauth-fullName', focusKey: 'oauth-complete' })

  async function handleSubmit(values: z.infer<typeof completeSignupSchema>) {
    if (redirectingRef.current) return

    setIsSubmitting(true)
    setGlobalError(null)

    try {
      const result = await invokeAuthAction(
        () => completeOAuthSignupAction(values),
        AUTH_ONBOARDING_PATH,
      )

      if (!result.success) {
        setGlobalError(result.error ?? 'Something went wrong. Please try again.')
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
      setGlobalError(
        err instanceof TypeError
          ? 'Connection issue. Check your internet and try again.'
          : 'Something went wrong. Please try again.',
      )
    }

    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-[24px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">One more step</h1>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          We&rsquo;ve verified your email
          {prefilledEmail ? (
            <>
              {' '}
              (<span className="font-medium text-[var(--text-primary)]">{prefilledEmail}</span>)
            </>
          ) : null}
          . Confirm your name and we&rsquo;ll set up your workspace.
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
          <AuthFieldLabel htmlFor="oauth-fullName">Full name</AuthFieldLabel>
          <AuthInput
            id="oauth-fullName"
            autoComplete="name"
            enterKeyHint="done"
            placeholder="Alex Johnson"
            disabled={isSubmitting}
            invalid={Boolean(form.formState.errors.fullName)}
            {...form.register('fullName')}
          />
          <AuthFieldError message={form.formState.errors.fullName?.message} />
        </div>

        {globalError ? <GlobalErrorCallout message={globalError} /> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-[var(--radius-lg)] border-0 bg-[var(--accent)] font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Creating your workspace…
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
    </div>
  )
}
