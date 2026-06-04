'use client'

import { OnboardingChoiceList } from '@/components/onboarding/onboarding-wizard/OnboardingChoiceList'
import {
  OPERATING_MODELS,
  type OperatingModelId,
} from '@/lib/onboarding/operating-models'
import { cn } from '@/lib/utils'

type Props = {
  selected: OperatingModelId
  onSelect: (id: OperatingModelId) => void
  className?: string
}

const OPERATING_MODEL_OPTIONS = OPERATING_MODELS.map((model) => ({
  value: model.id,
  label: model.label,
  description: model.description,
}))

/** Operating model selection — same list pattern as onboarding industry picker. */
export function OperatingModelPicker({ selected, onSelect, className }: Props) {
  return (
    <OnboardingChoiceList
      className={cn('max-w-xl', className)}
      options={OPERATING_MODEL_OPTIONS}
      selected={selected}
      onSelect={(value) => onSelect(value as OperatingModelId)}
    />
  )
}
