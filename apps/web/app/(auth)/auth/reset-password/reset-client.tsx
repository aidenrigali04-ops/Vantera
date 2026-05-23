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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

export function ResetPasswordClient() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  // Supabase puts the recovery session in the URL hash on arrival. The
  // browser client picks it up automatically; we just need to verify a
  // session exists before allowing the form to submit.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let cancelled = false

    async function check() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        setReady(true)
      } else {
        setError('This reset link is invalid or has expired. Request a new one below.')
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(values: z.infer<typeof schema>) {
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: values.password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setDone(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Make sure it&rsquo;s at least 8 characters and something you&rsquo;ll remember.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
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

          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
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

          <Button type="submit" className="w-full" disabled={!ready || isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Form>

      {!ready ? (
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="font-medium text-foreground hover:underline">
            Request a new reset link
          </Link>
        </p>
      ) : null}
    </div>
  )
}
