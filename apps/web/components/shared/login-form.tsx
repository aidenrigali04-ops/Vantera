'use client'

import { AuthLayout } from '@/components/shared/auth-layout'
import { OAuthButtons } from '@/components/shared/oauth-buttons'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useBranding } from '@/lib/branding/context'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

function isNextRedirectError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

type LoginFormProps = {
  onSubmit: (values: z.infer<typeof loginSchema>) => Promise<{
    success: boolean
    error?: string
    redirectTo?: string
  }>
  /** When true, show OAuth buttons + signup link. Portal logins set this false. */
  showOAuth?: boolean
  /** Heading for the form (e.g. "Welcome back" vs "Client portal"). */
  heading?: string
  /** Subheading copy. */
  subheading?: string
  /** Sign-up link target — hidden when showOAuth is false. */
  signupHref?: string
}

export function LoginForm({
  onSubmit,
  showOAuth = true,
  heading = 'Welcome back',
  subheading = 'Sign in to your workspace.',
  signupHref = '/auth/signup',
}: LoginFormProps) {
  const branding = useBranding()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(
    searchParams?.get('error') ? decodeURIComponent(searchParams.get('error') ?? '') : null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function handleSubmit(values: z.infer<typeof loginSchema>) {
    setIsSubmitting(true)
    setError(null)

    let result
    try {
      result = await onSubmit(values)
    } catch (err) {
      // Server Action redirect() throws NEXT_REDIRECT on success — re-throw
      // so Next.js can navigate. Swallowing would strand the user here.
      if (isNextRedirectError(err)) throw err
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setIsSubmitting(false)
      return
    }

    if (!result.success) {
      setError(result.error ?? 'Sign in failed')
      setIsSubmitting(false)
      return
    }

    // Defense in depth: if the action returned a redirectTo instead of
    // calling redirect() (older deploys mid-rollout), fall back to a
    // full page navigation so the cookie set is guaranteed to be applied.
    const redirectTo = result.redirectTo ?? '/admin/dashboard'
    window.location.href = redirectTo
  }

  const isBusy = isSubmitting
  const buttonLabel = isSubmitting ? 'Signing in…' : 'Sign in'

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.businessName}
              className="h-10 w-auto object-contain"
            />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground">{subheading}</p>
        </div>

        {showOAuth ? (
          <>
            <OAuthButtons />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use email</span>
              </div>
            </div>
          </>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    {showOAuth ? (
                      <Link
                        href="/auth/forgot-password"
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Forgot password?
                      </Link>
                    ) : null}
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isBusy}>
              {buttonLabel}
            </Button>
          </form>
        </Form>

        {showOAuth ? (
          <p className="text-center text-sm text-muted-foreground">
            Don&rsquo;t have an account?{' '}
            <Link href={signupHref} className="font-medium text-foreground hover:underline">
              Get started for free
            </Link>
          </p>
        ) : null}
      </div>
    </AuthLayout>
  )
}
