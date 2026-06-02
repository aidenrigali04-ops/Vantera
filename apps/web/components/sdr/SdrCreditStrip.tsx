'use client'

import { formatSdrCredits, type SdrCreditStatus } from '@/lib/sdr/credit-types'
import { cn } from '@/lib/utils'
import { Infinity, Zap } from 'lucide-react'

type Props = {
  credits: SdrCreditStatus | undefined
  loading?: boolean
  onUpgradeClick?: () => void
  className?: string
}

export function SdrCreditStrip({ credits, loading, onUpgradeClick, className }: Props) {
  if (loading || !credits) {
    return (
      <div
        className={cn(
          'h-10 animate-pulse rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]',
          className,
        )}
      />
    )
  }

  const pct =
    credits.unlimited || credits.limit === null
      ? 100
      : Math.min(100, Math.round((credits.used / credits.limit) * 100))

  const low = !credits.unlimited && (credits.remaining ?? 0) <= 5
  const exhausted = !credits.unlimited && (credits.remaining ?? 0) <= 0

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5',
        low || exhausted
          ? 'border-[var(--warning)]/30 bg-[var(--warning-muted)]'
          : 'border-[var(--border-default)] bg-[var(--bg-subtle)]/50',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Zap
          className={cn(
            'h-4 w-4 shrink-0',
            low || exhausted ? 'text-[var(--warning)]' : 'text-[var(--accent)]',
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            SDR outreach credits
            {credits.trialActive ? (
              <span className="ml-2 text-[11px] font-normal text-[var(--accent)]">
                Trial · ends{' '}
                {credits.trialEndsAt
                  ? new Date(credits.trialEndsAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'soon'}
              </span>
            ) : null}
          </p>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {credits.unlimited ? (
              <span className="inline-flex items-center gap-1">
                <Infinity className="h-3 w-3" /> Unlimited this period
              </span>
            ) : (
              <>
                {formatSdrCredits(credits.remaining ?? 0)} remaining · {formatSdrCredits(credits.used)}{' '}
                used of {formatSdrCredits(credits.limit ?? 0)}
              </>
            )}
          </p>
        </div>
      </div>

      {!credits.unlimited ? (
        <div className="flex min-w-[120px] flex-1 items-center gap-2 sm:max-w-[200px]">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                low || exhausted ? 'bg-[var(--warning)]' : 'bg-[var(--accent)]',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {(low || exhausted) && onUpgradeClick ? (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="shrink-0 text-[12px] font-medium text-[var(--accent)] hover:underline"
            >
              Upgrade for credits
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
