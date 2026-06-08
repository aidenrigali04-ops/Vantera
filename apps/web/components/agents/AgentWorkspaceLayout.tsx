'use client'

import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft, Loader2, Rocket } from 'lucide-react'
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
    <AdminPageContent>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Agents
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {title}
              </h1>
              {statusLabel ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                    statusTone === 'success' &&
                      'bg-[var(--success-muted)] text-[var(--success)] ring-[var(--success)]/20',
                    statusTone === 'warning' &&
                      'bg-[var(--warning-muted)] text-[var(--warning)] ring-[var(--warning)]/20',
                    statusTone === 'neutral' &&
                      'bg-[var(--bg-overlay)] text-[var(--text-secondary)] ring-[var(--border-default)]',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      statusTone === 'success' && 'bg-[var(--success)]',
                      statusTone === 'warning' && 'bg-[var(--warning)]',
                      statusTone === 'neutral' && 'bg-[var(--text-tertiary)]',
                    )}
                    aria-hidden
                  />
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {subtitle}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={backHref}>
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
                Back to hub
              </Link>
            </Button>
            {onDeploy ? (
              <Button
                size="sm"
                disabled={deployDisabled || deployLoading}
                onClick={onDeploy}
                className="bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:items-start">
          <div className="min-w-0 space-y-6">{config}</div>
          <div className="min-w-0 xl:sticky xl:top-6">{analytics}</div>
        </div>

        {footer ? <div className="min-w-0">{footer}</div> : null}
      </div>
    </AdminPageContent>
  )
}
