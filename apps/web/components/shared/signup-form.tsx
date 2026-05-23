'use client'

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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const signupSchema = z.object({
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
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPendingNav, startNav] = useTransition()

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { businessName: '', email: '', password: '' },
  })

  async function handleSubmit(values: z.infer<typeof signupSchema>) {
    setIsSubmitting(true)
    setError(null)

    let result
    try {
      result = await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed')
      setIsSubmitting(false)
      return
    }

    if (!result.success) {
      setError(result.error ?? 'Account creation failed')
      setIsSubmitting(false)
      return
    }

    const redirectTo = result.redirectTo ?? '/admin/onboarding'

    // If the redirect target is an absolute URL (i.e. a different host like a
    // tenant subdomain), use window.location so the browser actually changes
    // hosts. Otherwise stay inside the Next router for a smooth transition.
    if (redirectTo.startsWith('http')) {
      window.location.href = redirectTo
      return
    }

    startNav(() => {
      router.replace(redirectTo)
      router.refresh()
    })
  }

  const isBusy = isSubmitting || isPendingNav
  const buttonLabel = isPendingNav
    ? 'Loading…'
    : isSubmitting
      ? 'Creating account…'
      : 'Create account'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Set up your business in under 10 minutes.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      placeholder="Acme HVAC"
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
                  <FormLabel>Work email</FormLabel>
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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isBusy}
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {buttonLabel}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By creating an account you agree to start the guided setup wizard.
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
    </div>
  )
}
