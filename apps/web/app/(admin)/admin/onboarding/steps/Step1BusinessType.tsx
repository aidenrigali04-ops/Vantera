'use client'

import { OnboardingChoiceList } from '@/components/onboarding/onboarding-wizard/OnboardingChoiceList'
import { motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { updateVertical } from '../actions'
import {
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

type Vertical =
  | 'hvac'
  | 'landscaping'
  | 'plumbing'
  | 'construction'
  | 'property_mgmt'
  | 'agency'
  | 'real_estate'

const VERTICALS: Array<{ value: Vertical; label: string; description: string }> = [
  { value: 'hvac', label: 'HVAC', description: 'Service calls, maintenance plans, equipment installs' },
  { value: 'landscaping', label: 'Landscaping', description: 'Recurring crews, estimates, seasonal contracts' },
  { value: 'plumbing', label: 'Plumbing', description: 'Emergency dispatch, quotes, job completion' },
  { value: 'construction', label: 'Construction', description: 'Projects, change orders, client milestones' },
  {
    value: 'property_mgmt',
    label: 'Property Management',
    description: 'Tenants, leases, maintenance, owners',
  },
  { value: 'agency', label: 'Agency', description: 'Campaigns, clients, ROI reporting' },
  { value: 'real_estate', label: 'Real Estate', description: 'Leads, transactions, agent performance' },
]

type Props = {
  accountId: string
  currentVertical: string | null
  primaryColor: string
  onComplete: (data: { vertical: Vertical }) => void
}

export function Step1BusinessType({ accountId, currentVertical, onComplete }: Props) {
  const [selected, setSelected] = useState<Vertical | null>(
    VERTICALS.find((v) => v.value === currentVertical)?.value ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (): Promise<boolean> => {
    if (!selected) {
      setError('Choose a business type to continue')
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() => updateVertical(accountId, selected))

      if (result == null) {
        setError('The server did not respond. Refresh the page and try again.')
        return false
      }

      if (result.success !== true) {
        const msg =
          ('error' in result && result.error) ||
          'Could not save your business type. Please try again.'
        setError(msg)
        return false
      }

      onComplete({ vertical: selected })
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step1BusinessType] updateVertical threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [accountId, onComplete, selected])

  useRegisterOnboardingStep({
    canAdvance: Boolean(selected),
    isSubmitting: saving,
    submit,
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-3">
      <motion.div variants={fadeUp}>
        <OnboardingChoiceList
          options={VERTICALS}
          selected={selected}
          onSelect={(value) => setSelected(value as Vertical)}
        />
      </motion.div>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
