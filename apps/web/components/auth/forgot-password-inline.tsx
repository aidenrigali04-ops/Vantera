'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

type Props = {
  defaultEmail?: string
  onCancel: () => void
  className?: string
}

export function ForgotPasswordInline({ defaultEmail = '', onCancel, className }: Props) {
  const [email, setEmail] = useState(defaultEmail)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSend() {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectTo = new URL('/auth/reset-password', window.location.origin).toString()
      await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      setSentTo(trimmed)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Connection issue. Check your internet and try again.'
          : 'Could not send reset link. Try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <div
        className={cn(
          'rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]',
          className,
        )}
        role="status"
      >
        Check your inbox. We sent a reset link to{' '}
        <span className="font-medium text-[var(--text-primary)]">{sentTo}</span>.
      </div>
    )
  }

  return (
    <div className={cn('space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3', className)}>
      <p className="text-[13px] text-[var(--text-secondary)]">Enter your email to reset your password.</p>
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email" className="text-[13px] font-medium text-[var(--text-secondary)]">
          Business email
        </Label>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="send"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="alex@acmeagency.com"
          disabled={isSubmitting}
          className="h-11 rounded-[var(--radius-lg)] border-[var(--border-default)] bg-[var(--bg-surface)] text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-sm)] placeholder:text-[var(--text-tertiary)]"
        />
      </div>
      {error ? (
        <p className="text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-10 flex-1 rounded-[var(--radius-lg)] border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
          onClick={handleSend}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
