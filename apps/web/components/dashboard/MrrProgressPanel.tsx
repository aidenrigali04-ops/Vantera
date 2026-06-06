'use client'

import { saveRevenueGoal } from '@/lib/revenue/actions'
import { Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export type RevenueProgress = {
  goal: number | null
  avgValue: number | null
  wonCount: number
  currentMrr: number
  pct: number
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const digits = (s: string) => Number(s.replace(/[^0-9.]/g, ''))

export function MrrProgressPanel({ data }: { data: RevenueProgress }) {
  const router = useRouter()
  const [editing, setEditing] = useState(data.goal == null)
  const [goal, setGoal] = useState(data.goal ? String(data.goal) : '')
  const [avg, setAvg] = useState(data.avgValue ? String(data.avgValue) : '')
  const [pending, start] = useTransition()

  function save() {
    const g = digits(goal)
    if (!g || g <= 0) return
    const a = avg ? digits(avg) : null
    start(async () => {
      await saveRevenueGoal({ mrrGoal: g, avgClientValue: a })
      setEditing(false)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600" aria-hidden />
          <h2 className="text-sm font-semibold text-stone-900">Set your revenue goal</h2>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Track progress toward it every time your agent wins a client.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                className="w-full bg-transparent px-2 py-2 text-sm text-stone-900 outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Avg value / client / mo
            </span>
            <div className="mt-1 flex items-center rounded-lg border border-stone-200 px-3 focus-within:border-stone-400">
              <span className="text-stone-400">$</span>
              <input
                value={avg}
                onChange={(event) => setAvg(event.target.value)}
                inputMode="numeric"
                placeholder="2,500"
                className="w-full bg-transparent px-2 py-2 text-sm text-stone-900 outline-none"
              />
            </div>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !digits(goal)}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save goal'}
          </button>
          {data.goal != null ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const goalNum = data.goal ?? 0
  const remaining = Math.max(0, goalNum - data.currentMrr)
  const clientsToGoal =
    data.avgValue && data.avgValue > 0 ? Math.ceil(remaining / data.avgValue) : null

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600" aria-hidden />
          <h2 className="text-sm font-semibold text-stone-900">Monthly revenue goal</h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-stone-400 transition-colors hover:text-stone-700"
        >
          Edit
        </button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-[-0.02em] text-stone-900">
          {money(data.currentMrr)}
        </span>
        <span className="text-sm text-stone-400">
          / {money(goalNum)} · {data.pct}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${data.pct}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-stone-500">
        {data.wonCount} {data.wonCount === 1 ? 'client' : 'clients'} won
        {data.pct >= 100
          ? ' · goal reached 🎉'
          : clientsToGoal != null && remaining > 0
            ? ` · ${clientsToGoal} more to hit your goal`
            : data.avgValue == null
              ? ' · add an avg client value to track progress'
              : ''}
      </p>
    </div>
  )
}
