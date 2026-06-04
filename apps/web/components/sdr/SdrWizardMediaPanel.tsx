'use client'

import type { SdrWizardMedia, SdrWizardPreviewId } from '@/lib/onboarding/sdr-wizard-slides'
import { cn } from '@/lib/utils'
import { Bot, Calendar, Mail, Radar, Rocket, Target } from 'lucide-react'
import type { JSX, ReactNode } from 'react'

function MockChrome({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] shadow-[var(--shadow-md)]',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
        <span className="size-2 rounded-full bg-[#ff5f57]" />
        <span className="size-2 rounded-full bg-[#febc2e]" />
        <span className="size-2 rounded-full bg-[#28c840]" />
      </div>
      {children}
    </div>
  )
}

function PreviewIdentity() {
  return (
    <MockChrome>
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-accent-muted)] text-[var(--brand-accent)]">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">Alex · SDR</p>
          <p className="text-[11px] text-[var(--text-secondary)]">alex@yourdomain.com</p>
        </div>
        <Mail className="h-4 w-4 text-[var(--text-tertiary)]" />
      </div>
    </MockChrome>
  )
}

function PreviewIcp() {
  return (
    <MockChrome>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
          <Target className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          ICP filters
        </div>
        {['VP Sales · SaaS', 'Phoenix, AZ', 'Exclude competitor.com'].map((label) => (
          <div
            key={label}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] text-[var(--text-secondary)]"
          >
            {label}
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

function PreviewSchedule() {
  return (
    <MockChrome>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
          <Calendar className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          Daily rhythm
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2">
            <p className="text-[var(--text-tertiary)]">New leads</p>
            <p className="mt-0.5 font-semibold text-[var(--text-primary)]">10 / day</p>
          </div>
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2">
            <p className="text-[var(--text-tertiary)]">Discovery</p>
            <p className="mt-0.5 font-semibold text-[var(--text-primary)]">Daily 8:00 AM (your timezone)</p>
          </div>
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewScout() {
  return (
    <MockChrome>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
          <Radar className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          Prospect Scout
        </div>
        {['Inline ICP search', 'Saved lead search', 'Auto-enroll 70+ ICP'].map((label, i) => (
          <div
            key={label}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-[10px]',
              i === 0
                ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)] text-[var(--text-primary)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
            )}
          >
            {label}
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

function PreviewLaunch() {
  return (
    <MockChrome>
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-muted)] text-[var(--success)]">
          <Rocket className="h-5 w-5" />
        </span>
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">Agent deploying</p>
        <p className="text-[10px] text-[var(--text-secondary)]">First discovery run starts now</p>
      </div>
    </MockChrome>
  )
}

const PREVIEWS: Record<SdrWizardPreviewId, () => JSX.Element> = {
  identity: PreviewIdentity,
  icp: PreviewIcp,
  schedule: PreviewSchedule,
  scout: PreviewScout,
  launch: PreviewLaunch,
}

type Props = {
  media: SdrWizardMedia
  slideId: string
  className?: string
}

export function SdrWizardMediaPanel({ media, slideId, className }: Props) {
  return (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]',
        className,
      )}
    >
      <div key={slideId} className="flex h-full min-h-[240px] items-center justify-center p-4 lg:min-h-[320px]">
        {media.type === 'preview' ? (
          <div className="w-full max-w-[320px]">
            {PREVIEWS[media.previewId]()}
          </div>
        ) : null}
        {media.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.src} alt={media.alt} className="h-full w-full object-cover object-top" />
        ) : null}
      </div>
    </div>
  )
}
