'use client'

import { IcpScoreRing, icpScoreLabel } from '@/components/aspire/IcpScoreRing'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { scoreICP } from '@/lib/aspire/icp-score'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { aspireIntentTone } from '@/lib/operational/aspire-table-views'
import { cn } from '@/lib/utils'
import { Check, ExternalLink, Loader2, Mail, Phone } from 'lucide-react'
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

function contactPill(active: boolean) {
  return cn(
    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
    active
      ? 'bg-[var(--success-muted)] text-[var(--success)] ring-[var(--success)]/20'
      : 'bg-[var(--bg-subtle)] text-[var(--text-disabled)] ring-[var(--border-default)]',
  )
}

export function AspireIntelligencePanel({
  result,
  icpConfig,
  enrollState = 'idle',
  onAdd,
  onSkip,
}: Props) {
  if (!result) {
    return (
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Intelligence</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Select a prospect to see ICP score, signals, and contact quality.
        </p>
      </div>
    )
  }

  const scored = scoreICP(result, icpConfig)
  const score = result.icpScore ?? scored.score
  const signals = result.icpSignals?.length ? result.icpSignals : scored.signals

  return (
    <div className="card-surface p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Intelligence</h3>
      <p className="mt-1 text-[12px] text-[var(--text-secondary)]">ICP fit for your vertical</p>

      <div className="mt-4 flex flex-col items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
        <IcpScoreRing score={score} />
        <div className="text-center">
          <StatusBadge label={icpScoreLabel(score)} tone={aspireIntentTone(score)} />
          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{prospectName(result)}</p>
          <p className="text-[12px] text-[var(--text-secondary)]">{result.title}</p>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {result.organizationName ?? result.company}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            Score breakdown
          </p>
          <ul className="space-y-1.5 text-[12px]">
            {[
              ['Title match', scored.breakdown.titleMatch, 30],
              ['Industry', scored.breakdown.industryMatch, 25],
              ['Company size', scored.breakdown.sizeMatch, 20],
              ['Contact quality', scored.breakdown.contactQuality, 15],
              ['Tech bonus', scored.breakdown.techBonus, 10],
            ].map(([label, value, max]) => (
              <li key={String(label)} className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {value}/{max}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            Contact
          </p>
          <div className="flex flex-wrap gap-2">
            <span className={contactPill(Boolean(result.email))}>
              <Mail className="h-3 w-3" />
              Email
            </span>
            <span className={contactPill(Boolean(result.phone))}>
              <Phone className="h-3 w-3" />
              Phone
            </span>
            <span className={contactPill(Boolean(result.linkedinUrl))}>
              <ExternalLink className="h-3 w-3" />
              LinkedIn
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px] text-[var(--text-secondary)]">
            <li>
              <span className="text-[var(--text-tertiary)]">Email:</span>{' '}
              {result.email ? (
                <a href={`mailto:${result.email}`} className="text-[var(--accent)] hover:underline">
                  {result.email}
                </a>
              ) : (
                '—'
              )}
            </li>
            <li>
              <span className="text-[var(--text-tertiary)]">Phone:</span> {result.phone ?? '—'}
            </li>
            <li>
              <span className="text-[var(--text-tertiary)]">LinkedIn:</span>{' '}
              {result.linkedinUrl ? (
                <a
                  href={result.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  View profile
                </a>
              ) : (
                '—'
              )}
            </li>
          </ul>
        </div>

        {signals.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Key signals
            </p>
            <ul className="space-y-1">
              {signals.map((signal) => (
                <li key={signal} className="text-[12px] text-[var(--text-secondary)]">
                  · {signal}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.employeeCount ? (
          <p className="text-[12px] text-[var(--text-tertiary)]">~{result.employeeCount} employees</p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Button
          className="w-full bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
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
