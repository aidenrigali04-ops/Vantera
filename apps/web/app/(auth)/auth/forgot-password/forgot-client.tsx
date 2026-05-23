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
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

export function ForgotPasswordClient() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function handleSubmit(values: z.infer<typeof schema>) {
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectTo = new URL('/auth/reset-password', window.location.origin).toString()

      // We don't surface "user not found" — to avoid email enumeration we
      // always show the same success message regardless of outcome.
      await supabase.auth.resetPasswordForEmail(values.email, { redirectTo })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, we sent a link you can use to set a new password.
            The link expires in 1 hour.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-block text-sm font-medium text-foreground hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email associated with your account and we&rsquo;ll send you a link to set a new
          password.
        </p>
      </div>

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

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/auth/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
