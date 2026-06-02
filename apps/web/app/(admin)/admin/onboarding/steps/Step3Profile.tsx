'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Heart, Megaphone, Phone, Sparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useOnboardingNav, useRegisterOnboardingStep } from '../onboarding-nav'
import { getBusinessProfile, updateBusinessProfile } from '../actions'
import {
  FieldGroup,
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

type Voice = 'friendly' | 'professional' | 'urgent'

const VOICES: Array<{
  value: Voice
  label: string
  example: string
  icon: typeof Heart
  accent: string
}> = [
  {
    value: 'friendly',
    label: 'Friendly',
    example: '"Hey Sam! Just a heads up — your appointment is tomorrow at 2pm 👋"',
    icon: Heart,
    accent: '#EC4899',
  },
  {
    value: 'professional',
    label: 'Professional',
    example: '"Hi Sam, this is a reminder that your appointment is scheduled for tomorrow at 2pm."',
    icon: Sparkles,
    accent: '#3B82F6',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    example: '"URGENT — appointment tomorrow at 2pm. Reply to confirm or reschedule."',
    icon: Zap,
    accent: '#F59E0B',
  },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

const HTTPS_URL = /^https?:\/\/[^\s]+$/i
const PHONE_REGEX = /^[+0-9 ()-]{7,30}$/

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
      try {
        const result = await runStepAction(() => getBusinessProfile(accountId))
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
      } catch (err) {
        rethrowFrameworkNavigation(err)
        console.warn('[Step3Profile] getBusinessProfile threw', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
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

  const submit = useCallback(async (): Promise<boolean> => {
    const validation = validate()
    if (validation) {
      setError(validation)
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() =>
        updateBusinessProfile(accountId, {
          voicePreference: voice ?? null,
          businessHoursStart: hoursStart ?? null,
          businessHoursEnd: hoursEnd ?? null,
          bookingLink: bookingLink.trim() || null,
          reviewLink: reviewLink.trim() || null,
          paymentLink: paymentLink.trim() || null,
          emergencyLine: emergencyLine.trim() || null,
        }),
      )

      if (!result || result.success !== true) {
        const msg =
          (result && 'error' in result && result.error) ||
          'Could not save your profile. Please try again.'
        setError(msg)
        return false
      }

      onComplete({ rePersonalized: result.data.rePersonalized })
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step3Profile] updateBusinessProfile threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [
    accountId,
    bookingLink,
    emergencyLine,
    hoursEnd,
    hoursStart,
    onComplete,
    paymentLink,
    reviewLink,
    voice,
  ])

  const embedded = Boolean(useOnboardingNav())

  useRegisterOnboardingStep({
    canAdvance: !loading,
    isSubmitting: saving,
    submit,
  })

  if (loading) {
    return (
      <motion.div variants={stepContainer} initial="hidden" animate="show">
        <motion.div
          variants={fadeUp}
          className="h-28 animate-pulse rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]"
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={stepContainer}
      initial="hidden"
      animate="show"
      className={cn('space-y-4', embedded && 'max-h-[280px] overflow-y-auto pr-1')}
    >
      <FieldGroup
        label="Voice"
        description="Sets the tone our AI uses when rewriting your template messages."
        right={
          voice ? (
            <button
              type="button"
              onClick={() => setVoice(null)}
              className="text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {VOICES.map((v) => (
            <VoiceTile
              key={v.value}
              voice={v}
              selected={voice === v.value}
              primaryColor={primaryColor}
              onClick={() => setVoice(voice === v.value ? null : v.value)}
            />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        label="Business hours"
        description="Used by after-hours automations (e.g. property management's “We're closed” auto-reply)."
      >
        <div className="grid grid-cols-2 gap-3">
          <HourSelect
            id="hours-start"
            label="Opens at"
            value={hoursStart}
            onChange={setHoursStart}
          />
          <HourSelect id="hours-end" label="Closes at" value={hoursEnd} onChange={setHoursEnd} />
        </div>
      </FieldGroup>

      <FieldGroup
        label="Customer-facing links"
        description="These replace {{booking_link}}, {{review_link}}, and {{payment_link}} in your message templates. Skip a field to use your portal's default."
      >
        <div className="space-y-3">
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
        </div>
      </FieldGroup>

      <FieldGroup
        label="Emergency line"
        description="Shown in after-hours messages. Substitutes {{emergency_line}}."
      >
        <div className="relative">
          <Phone
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
            aria-hidden
          />
          <Input
            id="emergency-line"
            type="tel"
            placeholder="+1 (555) 555-0911"
            value={emergencyLine}
            onChange={(e) => setEmergencyLine(e.target.value)}
            className="h-11 border-white/[0.08] bg-white/[0.02] pl-10 text-sm text-white placeholder:text-white/30 focus-visible:border-white/[0.2] focus-visible:ring-1 focus-visible:ring-white/10"
          />
        </div>
      </FieldGroup>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}

function VoiceTile({
  voice,
  selected,
  primaryColor,
  onClick,
}: {
  voice: { value: Voice; label: string; example: string; icon: typeof Megaphone; accent: string }
  selected: boolean
  primaryColor: string
  onClick: () => void
}) {
  const Icon = voice.icon
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={
        selected
          ? {
              borderColor: `${primaryColor}66`,
              boxShadow: `0 0 0 1px ${primaryColor}40, 0 12px 28px -16px ${primaryColor}aa`,
            }
          : undefined
      }
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4 text-left transition-colors duration-200',
        selected
          ? 'bg-white/[0.04]'
          : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.035]',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 size-28 rounded-full blur-2xl transition-opacity duration-500',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
        style={{ background: `radial-gradient(circle at center, ${voice.accent}66, transparent 70%)` }}
      />

      <div className="relative flex items-center gap-2">
        <span
          aria-hidden
          style={{
            background: selected
              ? `linear-gradient(135deg, ${voice.accent}33, ${voice.accent}0a)`
              : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            boxShadow: selected
              ? `inset 0 0 0 1px ${voice.accent}33`
              : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg"
        >
          <Icon
            className="h-4 w-4"
            style={{ color: selected ? voice.accent : 'rgba(255,255,255,0.55)' }}
            aria-hidden
          />
        </span>
        <p className="text-sm font-semibold text-white">{voice.label}</p>
      </div>
      <p className="relative mt-3 text-xs italic leading-relaxed text-white/55">{voice.example}</p>
    </motion.button>
  )
}

function HourSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-white/55">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-11 w-full appearance-none rounded-md border border-white/[0.08] bg-white/[0.02] px-3 text-sm text-white outline-none transition-colors hover:border-white/[0.16] focus:border-white/[0.25]"
      >
        <option value="" className="bg-[#0B1015] text-white">
          — Not set —
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h} className="bg-[#0B1015] text-white">
            {fmtHour(h)}
          </option>
        ))}
      </select>
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
      <label htmlFor={id} className="text-xs text-white/55">
        {label}
      </label>
      <Input
        id={id}
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 border-white/[0.08] bg-white/[0.02] text-sm text-white placeholder:text-white/30 focus-visible:border-white/[0.2] focus-visible:ring-1 focus-visible:ring-white/10"
      />
    </div>
  )
}
