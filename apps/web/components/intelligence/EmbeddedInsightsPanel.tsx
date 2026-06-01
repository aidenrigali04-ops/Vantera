'use client'

import { dismissEmbeddedInsight } from '@/lib/intelligence/actions'
import type { EmbeddedInsight, InsightSeverity } from '@/lib/intelligence/types'
import { cn } from '@/lib/utils'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

const SEVERITY_STYLES: Record<
  InsightSeverity,
  { border: string; badge: string; icon: string }
> = {
  red: {
    border: 'border-red-200/80 bg-red-50/40',
    badge: 'bg-red-50 text-red-700 ring-red-200/80',
    icon: 'text-red-600',
  },
  yellow: {
    border: 'border-amber-200/80 bg-amber-50/40',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/80',
    icon: 'text-amber-600',
  },
  green: {
    border: 'border-emerald-200/80 bg-emerald-50/40',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
    icon: 'text-emerald-600',
  },
}

type EmbeddedInsightCardProps = {
  insight: EmbeddedInsight
  onDismiss?: (id: string) => void
  compact?: boolean
}

export function EmbeddedInsightCard({ insight, onDismiss, compact = false }: EmbeddedInsightCardProps) {
  const styles = SEVERITY_STYLES[insight.severity]

  return (
    <article
      className={cn(
        'rounded-xl border p-4 shadow-sm transition-colors',
        styles.border,
        compact ? 'p-3' : 'p-4',
      )}
    >
      <div className="flex items-start gap-3">
        <Sparkles className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('font-medium text-stone-900', compact ? 'text-[13px]' : 'text-sm')}>
              {insight.headline}
            </p>
            {insight.dismissible && onDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss(insight.id)}
                className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-white/80 hover:text-stone-700"
                aria-label="Dismiss insight"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {insight.recommendation ? (
            <p className={cn('mt-1.5 leading-relaxed text-stone-600', compact ? 'text-[12px]' : 'text-[13px]')}>
              {insight.recommendation}
            </p>
          ) : null}
          {insight.actionLabel ? (
            <Link
              href={insight.actionHref}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-stone-800 underline-offset-2 hover:underline"
            >
              {insight.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}

type EmbeddedInsightsPanelProps = {
  insights: EmbeddedInsight[]
  title?: string
  subtitle?: string
  emptyMessage?: string
  compact?: boolean
}

export function EmbeddedInsightsPanel({
  insights: initialInsights,
  title = 'Operational intelligence',
  subtitle = 'Embedded in your workflow — not a chatbot.',
  emptyMessage = 'No insights right now. The system will surface risks and opportunities as data comes in.',
  compact = false,
}: EmbeddedInsightsPanelProps) {
  const [insights, setInsights] = useState(initialInsights)

  async function handleDismiss(id: string) {
    const previous = insights
    setInsights((current) => current.filter((item) => item.id !== id))
    if (!id.startsWith('derived-')) {
      const result = await dismissEmbeddedInsight(id)
      if (!result.success) {
        setInsights(previous)
        toast.error(result.error ?? 'Could not dismiss insight')
      }
    }
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center">
        <p className="text-[13px] text-stone-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title ? (
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[12px] text-stone-500">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className={cn('space-y-3', !compact && 'sm:space-y-3')}>
        {insights.map((insight) => (
          <EmbeddedInsightCard
            key={insight.id}
            insight={insight}
            onDismiss={handleDismiss}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}
