'use client'

import { markOnboardingCompleteAction } from '@/app/(admin)/admin/onboarding/actions'
import { saveRevenueGoal } from '@/lib/revenue/actions'
import { Target } from 'lucide-react'
import { useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'

const digits = (s: string) => Number(s.replace(/[^0-9.]/g, ''))

export function StepRevenueGoal({ accountId }: { accountId: string }) {
  const [goal, setGoal] = useState('')
  const [avg, setAvg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const goalNum = digits(goal)

  useRegisterOnboardingStep({
    canAdvance: goalNum > 0,
    isSubmitting: submitting,
    submit: async () => {
      const g = digits(goal)
      if (!g || g <= 0) return false
      setSubmitting(true)
      try {
        await saveRevenueGoal({ mrrGoal: g, avgClientValue: avg ? digits(avg) : null })
        await markOnboardingCompleteAction()
        return true
      } catch {
        setSubmitting(false)
        return false
      }
    },
  })

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-emerald-600" aria-hidden />
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-stone-900">
          Set your revenue goal
        </h2>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Your dashboard tracks real progress toward this as your agent books and wins clients.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            Monthly revenue goal
          </span>
          <div className="mt-1 flex items-center rounded-lg border border-stone-200 px-3 focus-within:border-stone-400">
            <span className="text-stone-400">$</span>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              inputMode="numeric"
              placeholder="50,000"
              autoFocus
              className="w-full bg-transparent px-2 py-2.5 text-sm text-stone-900 outline-none"
            />
            <span className="text-sm text-stone-400">/mo</span>
          </div>
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            Average value per client / mo{' '}
            <span className="normal-case text-stone-300">(optional)</span>
          </span>
          <div className="mt-1 flex items-center rounded-lg border border-stone-200 px-3 focus-within:border-stone-400">
            <span className="text-stone-400">$</span>
            <input
              value={avg}
              onChange={(event) => setAvg(event.target.value)}
              inputMode="numeric"
              placeholder="2,500"
              className="w-full bg-transparent px-2 py-2.5 text-sm text-stone-900 outline-none"
            />
          </div>
          <span className="mt-1 block text-[12px] text-stone-400">
            Lets us turn each won client into real MRR progress.
          </span>
        </label>
      </div>
    </div>
  )
}
