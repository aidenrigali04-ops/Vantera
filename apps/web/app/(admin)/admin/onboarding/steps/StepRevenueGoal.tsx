'use client'

import { markOnboardingCompleteAction } from '@/app/(admin)/admin/onboarding/actions'
import { saveRevenueGoal } from '@/lib/revenue/actions'
import { Target } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'

const digits = (s: string) => Number(s.replace(/[^0-9.]/g, ''))

export function StepRevenueGoal({ accountId }: { accountId: string }) {
  const [goal, setGoal] = useState('')
  const [avg, setAvg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goalNum = digits(goal)

  const submit = useCallback(async () => {
    const g = digits(goal)
    if (!g || g <= 0) return false
    setSubmitting(true)
    setError(null)
    try {
      await saveRevenueGoal({ mrrGoal: g, avgClientValue: avg ? digits(avg) : null })
      await markOnboardingCompleteAction()
      return true
    } catch {
      setError('Something went wrong saving your goal. Please try again.')
      setSubmitting(false)
      return false
    }
  }, [avg, goal])

  useRegisterOnboardingStep({
    canAdvance: goalNum > 0,
    isSubmitting: submitting,
    submit,
  })

  return (
    <div className="mx-auto w-full max-w-md">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-emerald-600" aria-hidden />
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          Set your revenue goal
        </h2>
      </div>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        Your dashboard tracks real progress toward this as your agent books and wins clients.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Monthly revenue goal
          </span>
          <div className="mt-1 flex items-center rounded-lg border border-[var(--border-default)] px-3 focus-within:border-[var(--border-focus)]">
            <span className="text-[var(--text-tertiary)]">$</span>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              inputMode="numeric"
              placeholder="50,000"
              autoFocus
              className="w-full bg-transparent px-2 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            />
            <span className="text-sm text-[var(--text-tertiary)]">/mo</span>
          </div>
        </label>

        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Average value per client / mo{' '}
            <span className="normal-case text-[var(--text-disabled)]">(optional)</span>
          </span>
          <div className="mt-1 flex items-center rounded-lg border border-[var(--border-default)] px-3 focus-within:border-[var(--border-focus)]">
            <span className="text-[var(--text-tertiary)]">$</span>
            <input
              value={avg}
              onChange={(event) => setAvg(event.target.value)}
              inputMode="numeric"
              placeholder="2,500"
              className="w-full bg-transparent px-2 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>
          <span className="mt-1 block text-[12px] text-[var(--text-tertiary)]">
            Lets us turn each won client into real MRR progress.
          </span>
        </label>
      </div>
    </div>
  )
}
