'use client'

import type { EmailSetupStep } from '@/lib/outreach/email-hub'
import { cn } from '@/lib/utils'
import { Check, Circle, Loader2, X } from 'lucide-react'

type EmailSetupPipelineProps = {
  steps: EmailSetupStep[]
  progress: number
}

function StepIcon({ status }: { status: EmailSetupStep['status'] }) {
  switch (status) {
    case 'complete':
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success-muted)] text-[var(--success)]">
          <Check className="h-4 w-4" aria-hidden />
        </span>
      )
    case 'failed':
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--danger-muted)] text-[var(--danger)]">
          <X className="h-4 w-4" aria-hidden />
        </span>
      )
    case 'current':
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)] ring-2 ring-[var(--accent-border)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        </span>
      )
    default:
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]">
          <Circle className="h-3 w-3" aria-hidden />
        </span>
      )
  }
}

export function EmailSetupPipeline({ steps, progress }: EmailSetupPipelineProps) {
  return (
    <section className="card-surface p-5 sm:p-6" aria-labelledby="email-setup-pipeline-heading">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="email-setup-pipeline-heading"
            className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
          >
            Email setup pipeline
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Domain → sending verification → reply routing → live outreach.
          </p>
        </div>
        <div className="min-w-[140px]">
          <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-secondary)]">
            <span>Progress</span>
            <span className="tabular-nums text-[var(--text-primary)]">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="grid gap-4 md:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              'relative rounded-xl border p-4 transition-colors duration-120 ease',
              step.status === 'current' &&
                'border-[var(--accent-border)] bg-[var(--accent-muted)]/40',
              step.status === 'complete' &&
                'border-[var(--border-subtle)] bg-[var(--bg-surface)]',
              step.status === 'failed' &&
                'border-[var(--danger)]/30 bg-[var(--danger-muted)]',
              step.status === 'pending' &&
                'border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50',
            )}
          >
            {index < steps.length - 1 ? (
              <span
                className="absolute -right-2 top-10 hidden h-px w-4 bg-[var(--border-default)] md:block"
                aria-hidden
              />
            ) : null}
            <div className="flex items-start gap-3">
              <StepIcon status={step.status} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Step {index + 1}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-[var(--text-primary)]">
                  {step.title}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {step.description}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
