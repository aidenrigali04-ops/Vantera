'use client'

import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import Link from 'next/link'
import { useMemo } from 'react'

function formatCurrency(cents: number): string {
  if (!cents) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

type Props = {
  deals: DashboardSnapshot['deals']
  showCleanSlate?: boolean
}

export function DashboardPipelineSnapshot({ deals, showCleanSlate = false }: Props) {
  const { setNewClientDrawerOpen } = useOnboardingStore()

  const stages = useMemo(() => {
    const byStage = new Map<
      string,
      { label: string; color: string; position: number; count: number; valueCents: number }
    >()

    for (const deal of deals) {
      if (deal.isTerminalLoss) continue
      const existing = byStage.get(deal.stageLabel) ?? {
        label: deal.stageLabel,
        color: deal.stageColor,
        position: deal.stagePosition,
        count: 0,
        valueCents: 0,
      }
      existing.count += 1
      existing.valueCents += deal.valueCents
      byStage.set(deal.stageLabel, existing)
    }

    return Array.from(byStage.values()).sort((a, b) => a.position - b.position)
  }, [deals])

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/80 px-6 py-10 text-center">
        <p className="text-sm font-medium text-stone-800">
          {showCleanSlate ? 'No opportunities yet.' : 'Pipeline is clear.'}
        </p>
        <p className="mt-1 text-[13px] text-stone-500">
          {showCleanSlate
            ? 'Add a client first, then create your first deal.'
            : 'Create a deal to start tracking revenue through stages.'}
        </p>
        {showCleanSlate ? (
          <button
            type="button"
            onClick={() => setNewClientDrawerOpen(true)}
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-stone-900 px-4 text-[13px] font-medium text-white hover:bg-stone-800"
          >
            Add first client
          </button>
        ) : (
          <Link
            href="/admin/pipeline"
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-stone-200 bg-white px-4 text-[13px] font-medium text-stone-800 hover:bg-stone-50"
          >
            Open pipeline
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-stone-100 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
            <th className="pb-3 pr-4 font-medium">Stage</th>
            <th className="pb-3 pr-4 font-medium">Deals</th>
            <th className="pb-3 font-medium text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {stages.map((stage) => (
            <tr key={stage.label} className="group transition-colors hover:bg-stone-50/80">
              <td className="py-3 pr-4">
                <Link href="/admin/pipeline" className="inline-flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    aria-hidden
                  />
                  <span className="font-medium text-stone-800 group-hover:text-stone-900">
                    {stage.label}
                  </span>
                </Link>
              </td>
              <td className="py-3 pr-4 text-stone-600">{stage.count}</td>
              <td className="py-3 text-right font-medium tabular-nums text-stone-900">
                {formatCurrency(stage.valueCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
