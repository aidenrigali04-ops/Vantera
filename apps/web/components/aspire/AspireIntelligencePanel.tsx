'use client'

import { IcpScoreRing, icpScoreLabel } from '@/components/aspire/IcpScoreRing'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { scoreICP } from '@/lib/aspire/icp-score'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { aspireIntentTone } from '@/lib/operational/aspire-table-views'
import { cn } from '@/lib/utils'
import { Check, Loader2, Mail, Phone } from 'lucide-react'
import type { ICPConfig } from '@/lib/aspire/types'

type Props = {
  result: AspireSearchResult | null
  icpConfig: ICPConfig
  enrollState?: 'idle' | 'pending' | 'added' | 'exists'
  onAdd?: () => void
  onSkip?: () => void
}

function prospectName(row: AspireSearchResult): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'
}

export function AspireIntelligencePanel({ result, icpConfig, enrollState = 'idle', onAdd, onSkip }: Props) {
  if (!result) {
    return (
      <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-stone-900">Intelligence</h3>
        <p className="text-sm text-stone-500">Select a prospect to see ICP score, signals, and contact quality.</p>
      </div>
    )
  }

  const scored = scoreICP(result, icpConfig)
  const score = result.icpScore ?? scored.score
  const signals = result.icpSignals?.length ? result.icpSignals : scored.signals

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-stone-900">Intelligence</h3>
      <p className="mb-4 text-[12px] text-stone-500">ICP fit for your vertical</p>

      <div className="flex flex-col items-center gap-3 border-b border-stone-100 pb-4">
        <IcpScoreRing score={score} />
        <div className="text-center">
          <StatusBadge label={icpScoreLabel(score)} tone={aspireIntentTone(score)} />
          <p className="mt-1 text-sm font-medium text-stone-900">{prospectName(result)}</p>
          <p className="text-[12px] text-stone-500">{result.title}</p>
          <p className="text-[12px] text-stone-500">{result.organizationName ?? result.company}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Score breakdown</p>
          <ul className="space-y-1.5 text-[12px]">
            {[
              ['Title match', scored.breakdown.titleMatch, 30],
              ['Industry', scored.breakdown.industryMatch, 25],
              ['Company size', scored.breakdown.sizeMatch, 20],
              ['Contact quality', scored.breakdown.contactQuality, 15],
              ['Tech bonus', scored.breakdown.techBonus, 10],
            ].map(([label, value, max]) => (
              <li key={String(label)} className="flex items-center justify-between gap-2">
                <span className="text-stone-600">{label}</span>
                <span className="font-mono text-stone-800">
                  {value}/{max}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Contact quality</p>
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset',
                result.email
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
                  : 'bg-stone-50 text-stone-400 ring-stone-200/80',
              )}
            >
              <Mail className="h-3 w-3" />
              Email
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset',
                result.phone
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
                  : 'bg-stone-50 text-stone-400 ring-stone-200/80',
              )}
            >
              <Phone className="h-3 w-3" />
              Phone
            </span>
          </div>
        </div>

        {signals.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Key signals</p>
            <ul className="space-y-1">
              {signals.map((signal) => (
                <li key={signal} className="text-[12px] text-stone-600">
                  · {signal}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.employeeCount ? (
          <p className="text-[12px] text-stone-500">~{result.employeeCount} employees</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          className="w-full bg-stone-900 hover:bg-stone-800"
          onClick={onAdd}
          disabled={!onAdd || enrollState === 'pending' || enrollState === 'added'}
        >
          {enrollState === 'pending' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : enrollState === 'added' ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : null}
          {enrollState === 'added'
            ? 'Added to pipeline'
            : enrollState === 'exists'
              ? 'Already in CRM'
              : 'Add to pipeline'}
        </Button>
        {onSkip ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={onSkip}>
            Skip
          </Button>
        ) : null}
      </div>
    </div>
  )
}
