'use client'

import { OnboardingChoiceList } from '@/components/onboarding/onboarding-wizard/OnboardingChoiceList'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import {
  applyVerticalTemplate,
  completeOnboarding,
  getBusinessProfile,
  getTemplatesForVertical,
  type TemplateSummary,
  updateBusinessProfile,
} from '../actions'
import {
  FieldGroup,
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

type Voice = 'friendly' | 'professional' | 'urgent'

const VOICES: Array<{ value: Voice; label: string; description: string }> = [
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Warm, conversational confirmations and follow-ups',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Clear, polished tone for client-facing messages',
  },
  {
    value: 'urgent',
    label: 'Direct',
    description: 'Short, action-oriented copy for time-sensitive outreach',
  },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function fmtHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

type Props = {
  accountId: string
  vertical: string | null
  onComplete: () => void
}

export function Step3DashboardSetup({ accountId, vertical, onComplete }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [voice, setVoice] = useState<Voice | null>('professional')
  const [hoursStart, setHoursStart] = useState<number>(8)
  const [hoursEnd, setHoursEnd] = useState<number>(17)

  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [profileResult, templateResult] = await Promise.all([
          runStepAction(() => getBusinessProfile(accountId)),
          vertical
            ? runStepAction(() => getTemplatesForVertical(vertical))
            : Promise.resolve(null),
        ])

        if (cancelled) return

        if (profileResult?.success) {
          const p = profileResult.data
          if (p.voicePreference) setVoice(p.voicePreference as Voice)
          if (p.businessHoursStart != null) setHoursStart(p.businessHoursStart)
          if (p.businessHoursEnd != null) setHoursEnd(p.businessHoursEnd)
        }

        if (templateResult?.success) {
          setTemplates(templateResult.data)
          if (templateResult.data.length === 1 && templateResult.data[0]) {
            setSelectedTemplateId(templateResult.data[0].id)
          }
        }
      } catch (err) {
        rethrowFrameworkNavigation(err)
        console.warn('[Step3DashboardSetup] load failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accountId, vertical])

  const submit = useCallback(async (): Promise<boolean> => {
    if (hoursStart >= hoursEnd) {
      setError('Open time must be earlier than close time')
      return false
    }

    if (templates.length > 0 && !selectedTemplateId) {
      setError('Choose a starter workflow to continue')
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const profileResult = await runStepAction(() =>
        updateBusinessProfile(accountId, {
          voicePreference: voice ?? null,
          businessHoursStart: hoursStart,
          businessHoursEnd: hoursEnd,
          bookingLink: null,
          reviewLink: null,
          paymentLink: null,
          emergencyLine: null,
        }),
      )

      if (!profileResult?.success) {
        setError(profileResult?.error ?? 'Could not save dashboard preferences')
        return false
      }

      if (selectedTemplateId) {
        const templateResult = await runStepAction(() =>
          applyVerticalTemplate(accountId, selectedTemplateId),
        )
        if (!templateResult?.success) {
          setError(templateResult?.error ?? 'Could not apply workflow template')
          return false
        }
      }

      const completeResult = await runStepAction(() => completeOnboarding(accountId))
      if (!completeResult?.success) {
        setError(completeResult?.error ?? 'Could not finish setup')
        return false
      }

      onComplete()
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [
    accountId,
    hoursEnd,
    hoursStart,
    onComplete,
    selectedTemplateId,
    templates.length,
    voice,
  ])

  useRegisterOnboardingStep({
    canAdvance: !loading && (templates.length === 0 || Boolean(selectedTemplateId)),
    isSubmitting: saving,
    primaryLabel: 'Finish setup',
    submit,
  })

  if (loading) {
    return (
      <motion.div variants={stepContainer} initial="hidden" animate="show">
        <motion.div
          variants={fadeUp}
          className="h-24 animate-pulse rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]"
        />
      </motion.div>
    )
  }

  const templateOptions = templates.map((template) => {
    const stageCount = Array.isArray(template.templateData.stages)
      ? template.templateData.stages.length
      : 0
    const automationCount = Array.isArray(template.templateData.automations)
      ? template.templateData.automations.length
      : 0
    const recordTypeLabel = template.recordType
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    return {
      value: template.id,
      label: `${recordTypeLabel} Workflow`,
      description: `${stageCount} stages · ${automationCount} automations`,
    }
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp}>
        <FieldGroup label="Message voice" description="Shapes AI rewrites on your dashboard">
          <OnboardingChoiceList
            options={VOICES}
            selected={voice}
            onSelect={(value) => setVoice(value as Voice)}
          />
        </FieldGroup>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="hours-start" className="text-[12px] text-[var(--text-secondary)]">
            Opens
          </Label>
          <select
            id="hours-start"
            value={hoursStart}
            onChange={(e) => setHoursStart(Number(e.target.value))}
            className="mt-1.5 flex h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)]"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="hours-end" className="text-[12px] text-[var(--text-secondary)]">
            Closes
          </Label>
          <select
            id="hours-end"
            value={hoursEnd}
            onChange={(e) => setHoursEnd(Number(e.target.value))}
            className="mt-1.5 flex h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)]"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {templates.length > 0 ? (
        <motion.div variants={fadeUp}>
          <FieldGroup label="Starter workflow" description="Pipeline layout on your dashboard">
            <OnboardingChoiceList
              options={templateOptions}
              selected={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          </FieldGroup>
        </motion.div>
      ) : null}

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
