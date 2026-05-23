'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
}

const VERTICALS: VerticalCard[] = [
  {
    value: 'hvac',
    label: 'HVAC',
    description: 'Manage service calls, maintenance plans, and equipment installs',
    icon: Wrench,
  },
  {
    value: 'landscaping',
    label: 'Landscaping',
    description: 'Run recurring crews, estimates, and seasonal contracts',
    icon: Leaf,
  },
  {
    value: 'plumbing',
    label: 'Plumbing',
    description: 'Handle emergency dispatch, quotes, and job completion',
    icon: Droplet,
  },
  {
    value: 'construction',
    label: 'Construction',
    description: 'Track projects, change orders, and client milestones',
    icon: HardHat,
  },
  {
    value: 'property_mgmt',
    label: 'Property Management',
    description: 'Manage tenants, leases, maintenance, and owners',
    icon: Building,
  },
  {
    value: 'agency',
    label: 'Agency',
    description: 'Deliver campaigns, manage clients, and prove ROI',
    icon: Briefcase,
  },
  {
    value: 'real_estate',
    label: 'Real Estate',
    description: 'Track leads, transactions, and agent performance',
    icon: Home,
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
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          What kind of business do you run?
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          We'll tailor your pipelines, automations, and AI tone to your industry — pick the closest
          match.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VERTICALS.map((vertical) => {
          const Icon = vertical.icon
          const isSelected = selected === vertical.value

          return (
            <button
              key={vertical.value}
              type="button"
              onClick={() => setSelected(vertical.value)}
              style={
                isSelected
                  ? {
                      borderColor: primaryColor,
                      boxShadow: `0 0 0 3px ${primaryColor}1f`,
                    }
                  : undefined
              }
              className={cn(
                'group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all duration-150',
                isSelected ? 'bg-card' : 'hover:border-foreground/20 hover:bg-accent/40',
              )}
            >
              <div
                style={
                  isSelected
                    ? { backgroundColor: `${primaryColor}1f`, color: primaryColor }
                    : undefined
                }
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isSelected
                    ? ''
                    : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/10 group-hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{vertical.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {vertical.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="lg"
          onClick={handleContinue}
          disabled={!selected || saving}
          style={selected ? { backgroundColor: primaryColor } : undefined}
          className="min-w-[140px]"
        >
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
