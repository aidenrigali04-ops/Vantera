'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft, Loader2, Rocket, Share2 } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle: string
  backHref?: string
  statusLabel?: string
  statusTone?: 'success' | 'warning' | 'neutral'
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
  backHref = '/admin/outreach/agents',
  statusLabel,
  statusTone = 'neutral',
  onDeploy,
  deployLabel = 'Deploy',
  deployDisabled,
  deployLoading,
  config,
  analytics,
  footer,
}: Props) {
  return (
    <div className="agent-dark min-h-screen bg-[var(--bg-base)]">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-6 md:px-10 md:py-8">

        {/* Back nav */}
        <Link
          href={backHref}
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Agents
        </Link>

        {/* Page header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-bold tracking-[-0.03em] text-[var(--text-primary)] lg:text-[32px]">
                {title}
              </h1>
              {statusLabel ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold',
                    statusTone === 'success' && 'bg-[var(--success-muted)] text-[var(--success)]',
                    statusTone === 'warning' && 'bg-[var(--warning-muted)] text-[var(--warning)]',
                    statusTone === 'neutral' && 'bg-[var(--bg-overlay)] text-[var(--text-secondary)]',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      statusTone === 'success' && 'animate-pulse bg-[var(--success)]',
                      statusTone === 'warning' && 'bg-[var(--warning)]',
                      statusTone === 'neutral' && 'bg-[var(--text-tertiary)]',
                    )}
                    aria-hidden
                  />
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
              {subtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              asChild
            >
              <Link href={backHref}>
                <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
                Share
              </Link>
            </Button>
            {onDeploy ? (
              <Button
                size="sm"
                disabled={deployDisabled || deployLoading}
                onClick={onDeploy}
                className="bg-[var(--accent)] font-semibold text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
              >
                {deployLoading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Rocket className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                {deployLabel}
              </Button>
            ) : null}
          </div>
        </header>

        {/* Two-column workspace */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* Left — configuration */}
          <div className="min-w-0 space-y-0">{config}</div>

          {/* Right — analytics panel */}
          <div className="min-w-0 xl:sticky xl:top-6">{analytics}</div>
        </div>

        {footer ? <div className="mt-8 min-w-0">{footer}</div> : null}
      </div>
    </div>
  )
}
