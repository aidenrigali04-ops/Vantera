'use client'

import { finalizeCheckoutSessionAction } from '@/lib/billing/subscription-actions'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  sessionId: string
}

/** Runs once after Stripe Checkout success during onboarding. */
export function OnboardingCheckoutReturn({ sessionId }: Props) {
  const router = useRouter()
  const started = useRef(false)
  const [message, setMessage] = useState('Confirming your subscription…')

  useEffect(() => {
    if (started.current) return
    started.current = true

    void (async () => {
      const result = await finalizeCheckoutSessionAction(sessionId)
      if (!result.success) {
        toast.error(result.error)
        setMessage('Something went wrong. Return to the plan step and try again.')
        router.replace('/admin/onboarding?checkout=error')
        return
      }
      toast.success('Welcome to Vantera Team')
      window.location.href = result.data.redirectTo
    })()
  }, [sessionId, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--brand-accent-muted)]" aria-hidden />
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  )
}
