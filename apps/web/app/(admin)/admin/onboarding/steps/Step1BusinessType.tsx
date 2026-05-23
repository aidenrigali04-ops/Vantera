'use client'

import { motion } from 'framer-motion'
import {
  Briefcase,
  Building,
  Droplet,
  HardHat,
  Home,
  Leaf,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { updateVertical } from '../actions'
import { PrimaryCTA, SelectableTile, StepError, StepHeader, fadeUp, stepContainer } from '../_primitives'

type Vertical =
  | 'hvac'
  | 'landscaping'
  | 'plumbing'
  | 'construction'
  | 'property_mgmt'
  | 'agency'
  | 'real_estate'

type VerticalCard = {
  value: Vertical
  label: string
  description: string
  icon: LucideIcon
  accent: string
}

const VERTICALS: VerticalCard[] = [
  {
    value: 'hvac',
    label: 'HVAC',
    description: 'Service calls, maintenance plans, equipment installs',
    icon: Wrench,
    accent: '#3B82F6',
  },
  {
    value: 'landscaping',
    label: 'Landscaping',
    description: 'Recurring crews, estimates, seasonal contracts',
    icon: Leaf,
    accent: '#10B981',
  },
  {
    value: 'plumbing',
    label: 'Plumbing',
    description: 'Emergency dispatch, quotes, job completion',
    icon: Droplet,
    accent: '#06B6D4',
  },
  {
    value: 'construction',
    label: 'Construction',
    description: 'Projects, change orders, client milestones',
    icon: HardHat,
    accent: '#F59E0B',
  },
  {
    value: 'property_mgmt',
    label: 'Property Management',
    description: 'Tenants, leases, maintenance, owners',
    icon: Building,
    accent: '#8B5CF6',
  },
  {
    value: 'agency',
    label: 'Agency',
    description: 'Campaigns, clients, ROI reporting',
    icon: Briefcase,
    accent: '#EC4899',
  },
  {
    value: 'real_estate',
    label: 'Real Estate',
    description: 'Leads, transactions, agent performance',
    icon: Home,
    accent: '#EF4444',
  },
]

type Props = {
  accountId: string
  currentVertical: string | null
  primaryColor: string
  onComplete: (data: { vertical: Vertical }) => void
}

export function Step1BusinessType({ accountId, currentVertical, primaryColor, onComplete }: Props) {
  const [selected, setSelected] = useState<Vertical | null>(
    VERTICALS.find((v) => v.value === currentVertical)?.value ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!selected) {
      setError('Choose a business type to continue')
      return
    }

    setError(null)
    setSaving(true)

    const result = await updateVertical(accountId, selected)

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onComplete({ vertical: selected })
  }

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-8">
      <StepHeader
        title="What kind of business do you run?"
        subtitle="We tailor pipelines, automations, and the AI tone to your industry — pick the closest match."
      />

      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VERTICALS.map((vertical) => (
          <SelectableTile
            key={vertical.value}
            selected={selected === vertical.value}
            primaryColor={primaryColor}
            iconColor={vertical.accent}
            onClick={() => setSelected(vertical.value)}
            icon={vertical.icon}
            title={vertical.label}
            description={vertical.description}
          />
        ))}
      </motion.div>

      {error ? <StepError message={error} /> : null}

      <motion.div variants={fadeUp} className="flex items-center justify-end">
        <PrimaryCTA
          type="button"
          onClick={handleContinue}
          disabled={!selected || saving}
          loading={saving}
          primaryColor={primaryColor}
        >
          {saving ? 'Saving…' : 'Continue'}
        </PrimaryCTA>
      </motion.div>
    </motion.div>
  )
}
