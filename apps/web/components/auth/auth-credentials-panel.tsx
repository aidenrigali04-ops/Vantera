'use client'

import { AuthEmailDivider } from '@/components/auth/auth-email-divider'
import { AuthInput, AuthFieldError, AuthFieldLabel } from '@/components/auth/auth-input'
import { AuthLegalNotice } from '@/components/auth/auth-legal-notice'
import { ForgotPasswordInline } from '@/components/auth/forgot-password-inline'
import { GlobalErrorCallout } from '@/components/auth/global-error-callout'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { PasswordField } from '@/components/auth/password-field'
import { Button } from '@/components/ui/button'
import {
  adminLoginAction,
  checkEmailAvailableAction,
  signupAction,
} from '@/lib/auth/actions'
import {
  EMAIL_EXISTS_MESSAGE,
  isEmailExistsError,
  isNetworkErrorMessage,
  loginFormSchema,
  signupFormSchema,
  type LoginFormValues,
  type SignupFormValues,
} from '@/lib/auth/form-schemas'
import { invokeAuthAction, isNextRedirectError } from '@/lib/auth/invoke-action'
import { resolveAuthModeFromSearch, type AuthMode } from '@/lib/auth/resolve-auth-mode'
import {
  AUTH_DASHBOARD_PATH,
  AUTH_ENTRY_PATH,
  AUTH_LOGIN_PATH,
  AUTH_ONBOARDING_PATH,
  AUTH_SIGNUP_PATH,
  type AuthIntent,
} from '@/lib/auth/routes'
import { useAuthFormBehavior } from '@/lib/auth/use-auth-form-behavior'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  workspace_missing:
    'We could not load your workspace after sign-up. Sign in with the email and password you just created.',
  missing_code: 'Sign-in was interrupted. Please try again.',
  no_user: 'Could not verify your account. Try again.',
  missing_email: 'Your account is missing an email address.',
  session_expired: 'Your session expired. Please sign in again.',
}

function resolveUrlError(raw: string | null, isOAuth: boolean): string | null {
  if (!raw) return null
  const decoded = decodeURIComponent(raw)
  if (isOAuth) return decoded
  return LOGIN_ERROR_MESSAGES[decoded] ?? decoded
}

type AuthCredentialsPanelProps = {
  initialMode?: AuthMode
  showOAuth?: boolean
  allowModeToggle?: boolean
  heading?: string
  subheading?: string
  portal?: boolean
  loginFallbackPath?: string
}

const HEADINGS: Record<AuthMode, { title: string; subtitle: string }> = {
  signup: {
    title: 'Run your business from one system',
    subtitle: 'The intelligent operating system for service businesses. No credit card required.',
  },
  login: {
    title: 'Sign in to your workspace',
    subtitle: 'Pick up where your pipeline left off.',
  },
}

export function AuthCredentialsPanel({
  initialMode = 'signup',
  showOAuth = true,
  allowModeToggle = true,
  heading,
  subheading,
  portal = false,
  loginFallbackPath = AUTH_DASHBOARD_PATH,
}: AuthCredentialsPanelProps) {
  const pathname = usePathname() ?? AUTH_SIGNUP_PATH
  const searchParams = useSearchParams()
  const signupFormRef = useRef<HTMLFormElement>(null)
  const loginFormRef = useRef<HTMLFormElement>(null)
  const redirectingRef = useRef(false)

  const urlMode = resolveAuthModeFromSearch(searchParams?.get('mode') ?? null, pathname)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [emailTaken, setEmailTaken] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  const isOAuthCallback = searchParams?.get('oauth') === '1'

  const oauthCallbackError = useMemo(() => {
    if (!isOAuthCallback) return null
    return resolveUrlError(searchParams?.get('error') ?? null, true)
  }, [isOAuthCallback, searchParams])

  const loginUrlError = useMemo(() => {
    if (mode !== 'login' || isOAuthCallback) return null
    return resolveUrlError(searchParams?.get('error') ?? null, false)
  }, [mode, isOAuthCallback, searchParams])

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { fullName: '', email: '', password: '' },
  })

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { email: '', password: '' },
  })

  const copy = HEADINGS[mode]
  const title = heading ?? copy.title
  const subtitle = subheading ?? copy.subtitle
  const isBusy = isSubmitting || checkingEmail
  const focusFieldId = mode === 'signup' ? 'fullName' : 'login-email'

  useAuthFormBehavior(mode === 'signup' ? signupFormRef : loginFormRef, {
    initialFocusId: focusFieldId,
    focusKey: mode,
  })

  const authPathForMode = useCallback(
    (next: AuthMode) => {
      const isUnifiedEntry =
        pathname === AUTH_ENTRY_PATH ||
        pathname === '/auth' ||
        pathname === '/auth/signup'

      if (isUnifiedEntry) {
        return next === 'login' ? `${AUTH_ENTRY_PATH}?mode=login` : AUTH_ENTRY_PATH
      }
      return next === 'login' ? AUTH_LOGIN_PATH : AUTH_SIGNUP_PATH
    },
    [pathname],
  )

  const switchMode = useCallback(
    (next: AuthMode) => {
      setMode(next)
      setGlobalError(null)
      setShowForgotPassword(false)
      setEmailTaken(false)
      if (typeof window !== 'undefined' && allowModeToggle) {
        window.history.replaceState({}, '', authPathForMode(next))
      }
    },
    [allowModeToggle, authPathForMode],
  )

  useEffect(() => {
    setMode(urlMode)
  }, [urlMode])

  useEffect(() => {
    if (loginUrlError && mode === 'login') {
      setGlobalError(loginUrlError)
    }
  }, [loginUrlError, mode])

  useEffect(() => {
    if (!showForgotPassword) return
    const timer = window.setTimeout(() => {
      document.getElementById('forgot-email')?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [showForgotPassword])

  async function verifyEmailAvailability(email: string) {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setEmailTaken(false)
      return
    }

    setCheckingEmail(true)
    try {
      const result = await checkEmailAvailableAction(trimmed)
      if (result.success && !result.data.available) {
        setEmailTaken(true)
        signupForm.setError('email', { message: EMAIL_EXISTS_MESSAGE })
      } else {
        setEmailTaken(false)
        if (signupForm.formState.errors.email?.message === EMAIL_EXISTS_MESSAGE) {
          signupForm.clearErrors('email')
        }
      }
    } catch {
      setGlobalError('Connection issue. Check your internet and try again.')
    } finally {
      setCheckingEmail(false)
    }
  }

  async function handleSignupSubmit(values: SignupFormValues) {
    if (emailTaken || redirectingRef.current) return

    setIsSubmitting(true)
    setGlobalError(null)

    try {
      const result = await invokeAuthAction(
        () => signupAction(values),
        AUTH_ONBOARDING_PATH,
      )

      if (!result.success) {
        if (isEmailExistsError(result.error)) {
          setEmailTaken(true)
          signupForm.setError('email', { message: EMAIL_EXISTS_MESSAGE })
        } else {
          setGlobalError(
            isNetworkErrorMessage(result.error)
              ? 'Connection issue. Check your internet and try again.'
              : result.error ?? 'Something went wrong. Please try again.',
          )
        }
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

  async function handleLoginSubmit(values: LoginFormValues) {
    if (redirectingRef.current) return

    setIsSubmitting(true)
    setGlobalError(null)

    try {
      const result = await invokeAuthAction(
        () => adminLoginAction(values),
        loginFallbackPath,
      )

      if (!result.success) {
        setGlobalError(result.error ?? 'Invalid email or password')
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

  const oauthIntent: AuthIntent = mode === 'signup' ? 'signup' : 'login'

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-[28px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {oauthCallbackError ? <GlobalErrorCallout message={oauthCallbackError} className="mb-0" /> : null}
      </div>

      {showOAuth ? (
        <>
          <OAuthButtons intent={oauthIntent} disabled={isBusy} />
          <AuthEmailDivider />
        </>
      ) : null}

      {mode === 'signup' ? (
        <form
          ref={signupFormRef}
          onSubmit={signupForm.handleSubmit(handleSignupSubmit)}
          className="space-y-4"
          noValidate
          aria-busy={isBusy}
        >
          <div className="space-y-1.5">
            <AuthFieldLabel htmlFor="fullName">Full name</AuthFieldLabel>
            <AuthInput
              id="fullName"
              autoComplete="name"
              enterKeyHint="next"
              placeholder="Alex Johnson"
              disabled={isBusy}
              invalid={Boolean(signupForm.formState.errors.fullName)}
              {...signupForm.register('fullName')}
            />
            <AuthFieldError message={signupForm.formState.errors.fullName?.message} />
          </div>

          <div className="space-y-1.5">
            <AuthFieldLabel htmlFor="signup-email">Email</AuthFieldLabel>
            <AuthInput
              id="signup-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder="alex@acmeagency.com"
              disabled={isBusy}
              invalid={Boolean(signupForm.formState.errors.email) || emailTaken}
              {...signupForm.register('email', {
                onBlur: (event) => {
                  void signupForm.trigger('email')
                  void verifyEmailAvailability(event.target.value)
                },
              })}
            />
            {emailTaken ? (
              <p className="text-[13px] text-[var(--danger)]" role="alert">
                An account with this email already exists.{' '}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2 hover:text-[var(--text-primary)]"
                  onClick={() => {
                    loginForm.setValue('email', signupForm.getValues('email'))
                    switchMode('login')
                  }}
                >
                  Sign in instead.
                </button>
              </p>
            ) : (
              <AuthFieldError message={signupForm.formState.errors.email?.message} />
            )}
          </div>

          <div className="space-y-1.5">
            <AuthFieldLabel htmlFor="signup-password">Password</AuthFieldLabel>
            <PasswordField
              id="signup-password"
              value={signupForm.watch('password')}
              onChange={(value) => signupForm.setValue('password', value)}
              onBlur={() => void signupForm.trigger('password')}
              autoComplete="new-password"
              enterKeyHint="done"
              placeholder="••••••••"
              showStrength
              disabled={isBusy}
              aria-invalid={Boolean(signupForm.formState.errors.password)}
            />
            <AuthFieldError message={signupForm.formState.errors.password?.message} />
          </div>

          {globalError ? <GlobalErrorCallout message={globalError} /> : null}

          <Button
            type="submit"
            className="h-11 w-full rounded-[var(--radius-lg)] border-0 bg-[var(--accent)] font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
            disabled={isBusy || emailTaken}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Creating your workspace…
              </>
            ) : (
              'Create workspace'
            )}
          </Button>

          <AuthLegalNotice />
        </form>
      ) : (
        <form
          ref={loginFormRef}
          onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
          className="space-y-4"
          noValidate
          aria-busy={isBusy}
        >
          <div className="space-y-1.5">
            <AuthFieldLabel htmlFor="login-email">Business email</AuthFieldLabel>
            <AuthInput
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder="alex@acmeagency.com"
              disabled={isBusy}
              invalid={Boolean(loginForm.formState.errors.email)}
              {...loginForm.register('email')}
            />
            <AuthFieldError message={loginForm.formState.errors.email?.message} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <AuthFieldLabel htmlFor="login-password">Password</AuthFieldLabel>
              {!portal && !showForgotPassword ? (
                <button
                  type="button"
                  className="text-[12px] font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </button>
              ) : null}
            </div>

            {showForgotPassword ? (
              <ForgotPasswordInline
                defaultEmail={loginForm.getValues('email')}
                onCancel={() => setShowForgotPassword(false)}
              />
            ) : (
              <>
                <PasswordField
                  id="login-password"
                  value={loginForm.watch('password')}
                  onChange={(value) => loginForm.setValue('password', value)}
                  onBlur={() => void loginForm.trigger('password')}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  disabled={isBusy}
                  aria-invalid={Boolean(loginForm.formState.errors.password)}
                />
                <AuthFieldError message={loginForm.formState.errors.password?.message} />
              </>
            )}
          </div>

          {globalError && !isOAuthCallback ? <GlobalErrorCallout message={globalError} /> : null}

          <Button
            type="submit"
            className={
              portal
                ? 'h-11 w-full rounded-lg border-0 font-medium text-white shadow-[var(--shadow-sm)] hover:opacity-90 disabled:opacity-60'
                : 'h-11 w-full rounded-[var(--radius-lg)] border-0 bg-[var(--accent)] font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-60'
            }
            style={portal ? { backgroundColor: 'var(--brand-primary)' } : undefined}
            disabled={isBusy || showForgotPassword}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : portal ? (
              'Sign in'
            ) : (
              'Sign in to your workspace'
            )}
          </Button>

          {portal ? (
            <p className="text-center text-[11px] leading-relaxed text-[var(--text-tertiary)]">
              Secure access for invited clients only.
            </p>
          ) : null}
        </form>
      )}

      {allowModeToggle && showOAuth ? (
        <p className="text-center text-[13px] text-[var(--text-tertiary)]">
          {mode === 'signup' ? (
            <>
              Already have a workspace?{' '}
              <button
                type="button"
                className="font-medium text-[var(--accent)] underline-offset-2 transition-colors duration-150 hover:text-[var(--accent-hover)] hover:underline"
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Vantera?{' '}
              <button
                type="button"
                className="font-medium text-[var(--accent)] underline-offset-2 transition-colors duration-150 hover:text-[var(--accent-hover)] hover:underline"
                onClick={() => switchMode('signup')}
              >
                Create your workspace
              </button>
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}
