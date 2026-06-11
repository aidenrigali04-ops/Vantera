'use client'

import { AgentConfigPanel } from '@/components/agents/AgentConfigPanel'
import { AgentStatusCard } from '@/components/agents/AgentStatusCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft, Loader2, Rocket, Share2 } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle: string
  /** Header eyebrow — defaults to the playground label; setup flows override it. */
  eyebrow?: string
  /** Config column heading — defaults to "Playground"; setup flows override it. */
  asideTitle?: string
  /** Full viewport height when rendered outside AdminShell (initial setup wizard). */
  standalone?: boolean
  backHref?: string
  statusLabel?: string
  statusDetail?: string
  statusTone?: 'success' | 'warning' | 'neutral'
  /** Setup mode before first deploy */
  isDraft?: boolean
  onDeploy?: () => void
  deployLabel?: string
  deployDisabled?: boolean
  deployLoading?: boolean
  config: ReactNode
  analytics: ReactNode
  footer?: ReactNode
}

export function AgentWorkspaceLayout({
  title,
  subtitle,
  eyebrow = 'Agent playground',
  asideTitle = 'Playground',
  standalone,
  backHref = '/admin/outreach/agents',
  statusLabel,
  statusDetail,
  statusTone = 'neutral',
  isDraft,
  onDeploy,
  deployLabel = 'Deploy',
  deployDisabled,
  deployLoading,
  config,
  analytics,
  footer,
}: Props) {
  const statusCardTone = isDraft
    ? 'draft'
    : statusTone === 'success'
      ? 'success'
      : statusTone === 'warning'
        ? 'warning'
        : 'neutral'

  const statusCardLabel = isDraft ? 'Ready to deploy' : (statusLabel ?? 'Ready to configure')
  const statusCardDetail = isDraft
    ? 'Everything below is pre-filled from your onboarding — deploy now and tune anytime.'
    : statusDetail

  return (
    <div
      className={cn(
        'agent-workspace flex flex-col bg-[var(--bg-base)]',
        standalone ? 'min-h-screen' : 'h-full min-h-0',
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]"
            aria-label="Back to agents"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {eyebrow}
            </p>
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isDraft ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[12px] text-[var(--text-secondary)] shadow-none hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              asChild
            >
              <Link href={backHref}>
                <Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Share
              </Link>
            </Button>
          ) : null}
          {onDeploy ? (
            <Button
              type="button"
              size="sm"
              disabled={deployDisabled || deployLoading}
              onClick={onDeploy}
              className="h-8 rounded-lg bg-[var(--accent)] px-4 text-[12px] font-semibold text-[var(--text-inverse)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] focus-visible:shadow-[var(--shadow-glow)]"
            >
              {deployLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Rocket className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              )}
              {deployLabel}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--bg-base)] lg:w-[min(440px,42%)] lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-4 md:px-6">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {asideTitle}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
            <AgentConfigPanel>
              <AgentStatusCard
                label={statusCardLabel}
                detail={statusCardDetail}
                tone={statusCardTone}
              />
              {config}
            </AgentConfigPanel>
            {footer ? <div className="mt-6 min-w-0">{footer}</div> : null}
          </div>
        </aside>

        <section className="relative min-h-[420px] min-w-0 flex-1 lg:min-h-0">{analytics}</section>
      </div>
    </div>
  )
}
