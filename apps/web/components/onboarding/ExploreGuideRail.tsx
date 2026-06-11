'use client'

import { useOperatingModel } from '@/lib/onboarding/use-operating-model'
import { cn } from '@/lib/utils'
import { ArrowRight, Briefcase, LayoutDashboard, Users, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const STEP_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  clients: Users,
  pipeline: Briefcase,
}

type Props = {
  accountId: string
  businessName: string
  className?: string
}

/** Guided exploration rail — visible during first-session onboarding only. */
export function ExploreGuideRail({ accountId, businessName, className }: Props) {
  const operatingModel = useOperatingModel(accountId)
  const [activeStep, setActiveStep] = useState(0)

  const steps = useMemo(
    () =>
      operatingModel.exploreSteps.map((step) => ({
        ...step,
        icon: STEP_ICONS[step.id] ?? LayoutDashboard,
      })),
    [operatingModel.exploreSteps],
  )

  useEffect(() => {
    const path = window.location.pathname
    const index = steps.findIndex((step) => path.startsWith(step.href))
    setActiveStep(index >= 0 ? index : 0)
  }, [steps])

  const displayName = businessName || 'Acme Agency'

  return (
    <aside
      className={cn(
        'rounded-xl border border-[var(--border-default)] bg-white p-5 shadow-sm',
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        Explore your workspace
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{displayName}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{operatingModel.exploreIntro}</p>

      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index === activeStep
          const isDone = index < activeStep

          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={cn(
                  'flex gap-3 rounded-lg border p-3 transition-colors',
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--bg-subtle)]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--bg-subtle)]',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : isActive
                        ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
                        : 'bg-[var(--bg-overlay)] text-[var(--text-tertiary)]',
                  )}
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--text-disabled)]" aria-hidden />
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {step.body}
                  </span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 self-center text-[var(--text-disabled)]" />
              </Link>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
