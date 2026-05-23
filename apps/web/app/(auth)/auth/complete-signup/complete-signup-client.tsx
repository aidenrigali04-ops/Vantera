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
import { completeOAuthSignupAction } from '@/lib/auth/actions'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
})

type CompleteSignupClientProps = {
  prefilledEmail: string
  prefilledName: string
}

export function CompleteSignupClient({
  prefilledEmail,
  prefilledName,
}: CompleteSignupClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPendingNav, startNav] = useTransition()

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: prefilledName, businessName: '' },
  })

  async function handleSubmit(values: z.infer<typeof schema>) {
    setIsSubmitting(true)
    setError(null)

    const result = await completeOAuthSignupAction(values)

    if (!result.success) {
      setError(result.error ?? 'Could not finish signup')
      setIsSubmitting(false)
      return
    }

    const redirectTo = result.data?.redirectTo ?? '/admin/dashboard'
    if (redirectTo.startsWith('http')) {
      window.location.href = redirectTo
      return
    }
    startNav(() => {
      router.replace(redirectTo)
      router.refresh()
    })
  }

  const busy = isSubmitting || isPendingNav

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">One more step</h1>
        <p className="text-sm text-muted-foreground">
          We&rsquo;ve verified your email
          {prefilledEmail ? (
            <>
              {' '}
              (<span className="font-medium text-foreground">{prefilledEmail}</span>)
            </>
          ) : null}
          . Tell us about your business and we&rsquo;ll set up your workspace.
        </p>
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

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Setting up workspace…' : 'Get started for free'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
