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
import { zodResolver } from '@hookform/resolvers/zod'
import { isNextRedirectError } from '@/lib/auth/invoke-action'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const signupSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignupFormProps = {
  onSubmit: (values: z.infer<typeof signupSchema>) => Promise<{
    success: boolean
    error?: string
    redirectTo?: string
  }>
}

export function SignupForm({ onSubmit }: SignupFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', businessName: '', email: '', password: '' },
  })

  async function handleSubmit(values: z.infer<typeof signupSchema>) {
    setIsSubmitting(true)
    setError(null)

    let result
    try {
      result = await onSubmit(values)
    } catch (err) {
      // Server Action redirect() throws NEXT_REDIRECT — re-throw so Next.js
      // can actually navigate. Swallowing it would strand the user here.
      if (isNextRedirectError(err)) throw err

      setError(err instanceof Error ? err.message : 'Account creation failed')
      setIsSubmitting(false)
      return
    }

    // Failure path — success uses redirect() and never returns here.
    if (!result?.success) {
      setError(result?.error ?? 'Account creation failed')
      setIsSubmitting(false)
      return
    }

    // Fallback if redirect() did not fire (older deploys mid-rollout).
    if (result.redirectTo) {
      window.location.href = result.redirectTo
    }
  }

  const isBusy = isSubmitting
  const buttonLabel = isSubmitting ? 'Setting up workspace…' : 'Get started for free'

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Start with sample data, then make it yours. No credit card required.
          </p>
        </div>

        <OAuthButtons />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or use email</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input type="text" autoComplete="name" placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="organization"
                      placeholder="Acme Agency"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business email</FormLabel>
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
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

            <p className="text-center text-xs text-muted-foreground">
              By creating an account you agree to the terms of service and privacy policy.
            </p>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
