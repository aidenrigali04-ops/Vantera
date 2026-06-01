'use client'

import { useOperatingModel } from '@/lib/onboarding/use-operating-model'
import { requestProductTourReplay } from '@/lib/onboarding/product-tour'
import { cn } from '@/lib/utils'
import { ArrowRight, Briefcase, LayoutDashboard, PlayCircle, Users, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const STEP_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  clients: Users,
  pipeline: Briefcase,
}

type Props = {
  accountId: string
  className?: string
}

/** Compact horizontal guide — orients new users without a full sidebar rail. */
export function ExploreGuideStrip({ accountId, className }: Props) {
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

  return (
    <nav
      aria-label="Explore your workspace"
      className={cn(
        'rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-stone-900">Quick tour</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-stone-500">
            {operatingModel.exploreIntro}
          </p>
          <button
            type="button"
            onClick={() => requestProductTourReplay()}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--brand-accent)] transition-colors hover:text-[var(--brand-accent-hover)]"
          >
            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
            Replay slideshow tour
          </button>
        </div>

        <ol className="flex flex-wrap gap-2 sm:justify-end">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === activeStep
            const isDone = index < activeStep

            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
                    isActive
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-stone-50/80 text-stone-700 hover:border-stone-300 hover:bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      isActive
                        ? 'bg-white/15 text-white'
                        : isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-white text-stone-500 ring-1 ring-stone-200',
                    )}
                  >
                    {isDone ? '✓' : index + 1}
                  </span>
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  <span>{step.title}</span>
                  {isActive ? <ArrowRight className="h-3 w-3 shrink-0 opacity-80" aria-hidden /> : null}
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
