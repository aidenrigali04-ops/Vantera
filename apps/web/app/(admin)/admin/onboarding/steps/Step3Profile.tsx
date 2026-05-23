'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { getBusinessProfile, updateBusinessProfile } from '../actions'

type Voice = 'friendly' | 'professional' | 'urgent'

const VOICES: Array<{ value: Voice; label: string; example: string }> = [
  {
    value: 'friendly',
    label: 'Friendly',
    example: '“Hey Sam! Just a heads up — your appointment is tomorrow at 2pm 👋”',
  },
  {
    value: 'professional',
    label: 'Professional',
    example: '“Hi Sam, this is a reminder that your appointment is scheduled for tomorrow at 2pm.”',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    example: '“URGENT — appointment tomorrow at 2pm. Reply to confirm or reschedule.”',
  },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

const HTTPS_URL = /^https?:\/\/[^\s]+$/i
const PHONE_REGEX = /^[+0-9 ()\-]{7,30}$/

type Props = {
  accountId: string
  primaryColor: string
  onComplete: (data: { rePersonalized: boolean }) => void
}

export function Step3Profile({ accountId, primaryColor, onComplete }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [voice, setVoice] = useState<Voice | null>(null)
  const [hoursStart, setHoursStart] = useState<number | null>(null)
  const [hoursEnd, setHoursEnd] = useState<number | null>(null)
  const [bookingLink, setBookingLink] = useState('')
  const [reviewLink, setReviewLink] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [emergencyLine, setEmergencyLine] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const result = await getBusinessProfile(accountId)
      if (cancelled) return
      if (result.success) {
        const p = result.data
        setVoice(p.voicePreference)
        setHoursStart(p.businessHoursStart)
        setHoursEnd(p.businessHoursEnd)
        setBookingLink(p.bookingLink ?? '')
        setReviewLink(p.reviewLink ?? '')
        setPaymentLink(p.paymentLink ?? '')
        setEmergencyLine(p.emergencyLine ?? '')
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [accountId])

  function validate(): string | null {
    if (hoursStart != null && hoursEnd != null && hoursStart >= hoursEnd) {
      return 'Open time must be earlier than close time'
    }
    if (bookingLink && !HTTPS_URL.test(bookingLink.trim())) {
      return 'Booking link must start with http:// or https://'
    }
    if (reviewLink && !HTTPS_URL.test(reviewLink.trim())) {
      return 'Review link must start with http:// or https://'
    }
    if (paymentLink && !HTTPS_URL.test(paymentLink.trim())) {
      return 'Payment link must start with http:// or https://'
    }
    if (emergencyLine && !PHONE_REGEX.test(emergencyLine.trim())) {
      return 'Emergency line must look like a phone number'
    }
    return null
  }

  async function handleContinue() {
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    setError(null)
    setSaving(true)

    const result = await updateBusinessProfile(accountId, {
      voicePreference: voice ?? null,
      businessHoursStart: hoursStart ?? null,
      businessHoursEnd: hoursEnd ?? null,
      bookingLink: bookingLink.trim() || null,
      reviewLink: reviewLink.trim() || null,
      paymentLink: paymentLink.trim() || null,
      emergencyLine: emergencyLine.trim() || null,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onComplete({ rePersonalized: result.data.rePersonalized })
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">
        Loading your profile…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Personalize your messaging</h2>
        <p className="text-sm text-muted-foreground">
          We'll use these to tailor every automated message your customers receive. Everything is
          optional — leave a field blank and we'll fall back to sensible defaults.
        </p>
      </div>

      <section className="space-y-3">
        <label className="text-sm font-medium">Voice</label>
        <p className="text-xs text-muted-foreground">
          Sets the tone our AI uses when rewriting your template messages.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {VOICES.map((v) => {
            const isSelected = voice === v.value
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => setVoice(isSelected ? null : v.value)}
                style={
                  isSelected
                    ? { borderColor: primaryColor, boxShadow: `0 0 0 1px ${primaryColor}` }
                    : undefined
                }
                className={cn(
                  'rounded-lg border bg-card p-4 text-left transition-colors',
                  isSelected ? 'bg-accent/30' : 'hover:bg-accent/40',
                )}
              >
                <p className="text-sm font-medium">{v.label}</p>
                <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
                  {v.example}
                </p>
              </button>
            )
          })}
        </div>
        {voice ? (
          <p className="text-xs text-muted-foreground">
            Click your selection again to clear it and use the default tone.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <label className="text-sm font-medium">Business hours</label>
        <p className="text-xs text-muted-foreground">
          Used by after-hours automations (e.g. property management's “We're closed” auto-reply).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="hours-start" className="text-xs text-muted-foreground">
              Opens at
            </label>
            <select
              id="hours-start"
              value={hoursStart ?? ''}
              onChange={(e) => setHoursStart(e.target.value === '' ? null : Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Not set —</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="hours-end" className="text-xs text-muted-foreground">
              Closes at
            </label>
            <select
              id="hours-end"
              value={hoursEnd ?? ''}
              onChange={(e) => setHoursEnd(e.target.value === '' ? null : Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Not set —</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <label className="text-sm font-medium">Customer-facing links (optional)</label>
        <p className="text-xs text-muted-foreground">
          These replace <code className="font-mono text-xs">{'{{booking_link}}'}</code>,{' '}
          <code className="font-mono text-xs">{'{{review_link}}'}</code>, and{' '}
          <code className="font-mono text-xs">{'{{payment_link}}'}</code> in your message templates.
          Skip a field to use your portal's default page.
        </p>

        <LinkField
          id="booking-link"
          label="Booking link"
          placeholder="https://calendly.com/your-business"
          value={bookingLink}
          onChange={setBookingLink}
        />
        <LinkField
          id="review-link"
          label="Review link"
          placeholder="https://g.page/r/your-business"
          value={reviewLink}
          onChange={setReviewLink}
        />
        <LinkField
          id="payment-link"
          label="Payment link"
          placeholder="https://buy.stripe.com/..."
          value={paymentLink}
          onChange={setPaymentLink}
        />
      </section>

      <section className="space-y-2">
        <label htmlFor="emergency-line" className="text-sm font-medium">
          Emergency line (optional)
        </label>
        <p className="text-xs text-muted-foreground">
          Shown in after-hours messages. Substitutes{' '}
          <code className="font-mono text-xs">{'{{emergency_line}}'}</code>.
        </p>
        <Input
          id="emergency-line"
          type="tel"
          placeholder="+1 (555) 555-0911"
          value={emergencyLine}
          onChange={(e) => setEmergencyLine(e.target.value)}
        />
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          style={{ backgroundColor: primaryColor }}
        >
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}

function LinkField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
