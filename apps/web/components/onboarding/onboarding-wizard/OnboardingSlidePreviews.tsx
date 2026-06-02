'use client'

import type { OnboardingWizardPreviewId } from '@/lib/onboarding/wizard-slides'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Handshake,
  Mail,
  MessageSquare,
  Palette,
  Plug,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'
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

function PreviewBusinessType() {
  const tiles = [
    { icon: Wrench, label: 'Home Services', active: true },
    { icon: Building2, label: 'Property Mgmt' },
    { icon: Briefcase, label: 'Agency' },
    { icon: Handshake, label: 'Real Estate' },
  ]
  return (
    <MockChrome>
      <div className="grid grid-cols-2 gap-2 p-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={cn(
              'rounded-lg border p-2.5',
              tile.active
                ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
            )}
          >
            <tile.icon
              className={cn(
                'h-4 w-4',
                tile.active ? 'text-[var(--brand-accent)]' : 'text-[var(--text-tertiary)]',
              )}
            />
            <p className="mt-2 text-[10px] font-medium text-[var(--text-primary)]">{tile.label}</p>
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

function PreviewIcp() {
  return (
    <MockChrome>
      <div className="space-y-2 p-3">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">Ideal customer profile</p>
        <div className="space-y-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5">
          <div className="h-2 w-full rounded bg-[var(--bg-overlay)]" />
          <div className="h-2 w-[92%] rounded bg-[var(--bg-overlay)]" />
          <div className="h-2 w-[78%] rounded bg-[var(--bg-overlay)]" />
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">Powers Aspire targeting &amp; ICP scoring</p>
      </div>
    </MockChrome>
  )
}

function PreviewValueProposition() {
  return (
    <MockChrome>
      <div className="space-y-2 p-3">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">Your value proposition</p>
        <div className="rounded-md border border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)] p-2.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
          Outcomes you deliver — woven into AI outreach and recommendations
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--brand-accent)]">
          <Sparkles className="h-3 w-3" />
          Shapes messaging tone
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewBranding() {
  return (
    <MockChrome>
      <div className="flex h-[220px] items-center gap-4 p-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-lg font-semibold text-[var(--text-primary)]"
          style={{ background: 'var(--brand-accent-muted)' }}
        >
          V
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
            <span className="text-[11px] font-medium text-[var(--text-primary)]">Brand colors</span>
          </div>
          <div className="flex gap-2">
            <span className="h-6 w-6 rounded-md bg-[var(--brand-accent)]" />
            <span className="h-6 w-6 rounded-md bg-[var(--success)]" />
          </div>
          <div className="h-8 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 text-[10px] leading-8 text-[var(--text-tertiary)]">
            portal.yourbrand.com
          </div>
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewVoice() {
  const tones = ['Professional', 'Friendly', 'Direct']
  return (
    <MockChrome>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
          <MessageSquare className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          Message tone
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tones.map((tone, i) => (
            <span
              key={tone}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-medium',
                i === 1
                  ? 'bg-[var(--brand-accent-muted)] text-[var(--brand-accent)]'
                  : 'bg-[var(--bg-overlay)] text-[var(--text-secondary)]',
              )}
            >
              {tone}
            </span>
          ))}
        </div>
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
          Hi Alex — your appointment is confirmed for Tuesday at 2pm. Reply if you need to reschedule.
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewWorkflow() {
  const stages = ['New lead', 'Qualified', 'Proposal', 'Won']
  return (
    <MockChrome>
      <div className="p-3">
        <p className="mb-2 text-[11px] font-semibold text-[var(--text-primary)]">Pipeline stages</p>
        <div className="flex gap-1.5 overflow-hidden">
          {stages.map((stage, i) => (
            <div
              key={stage}
              className={cn(
                'min-w-0 flex-1 rounded-md border px-2 py-2 text-center text-[9px] font-medium',
                i === 0
                  ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)] text-[var(--brand-accent)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
              )}
            >
              {stage}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
          <Sparkles className="h-3 w-3 text-[var(--brand-accent)]" />
          4 automations enabled
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewTeam() {
  return (
    <MockChrome>
      <div className="space-y-2 p-3">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">Team invites</p>
        {['manager@studio.com', 'tech@studio.com'].map((email) => (
          <div
            key={email}
            className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2"
          >
            <Mail className="h-3 w-3 text-[var(--text-tertiary)]" />
            <span className="truncate text-[10px] text-[var(--text-primary)]">{email}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--brand-accent)]">
          <Users className="h-3 w-3" />
          Magic link — no password
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewIntegrations() {
  const apps = [
    { label: 'Stripe', grad: 'from-[#635BFF] to-[#7A6BFF]' },
    { label: 'Twilio', grad: 'from-[#F22F46] to-[#F65A6E]' },
  ]
  return (
    <MockChrome>
      <div className="grid grid-cols-2 gap-2 p-3">
        {apps.map((app) => (
          <div
            key={app.label}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5"
          >
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-bold text-white',
                app.grad,
              )}
            >
              {app.label[0]}
            </span>
            <p className="mt-2 text-[10px] font-medium text-[var(--text-primary)]">{app.label}</p>
            <p className="text-[9px] text-[var(--success)]">Ready to connect</p>
          </div>
        ))}
        <div className="col-span-2 flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-default)] px-2 py-2 text-[10px] text-[var(--text-tertiary)]">
          <Plug className="h-3 w-3" />
          More integrations in settings
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewFinish() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-muted)] text-[var(--success)]">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <p className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">Workspace ready</p>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Head to your dashboard</p>
    </div>
  )
}

const PREVIEWS: Record<OnboardingWizardPreviewId, () => JSX.Element> = {
  'business-type': PreviewBusinessType,
  icp: PreviewIcp,
  'value-proposition': PreviewValueProposition,
  branding: PreviewBranding,
  voice: PreviewVoice,
  workflow: PreviewWorkflow,
  team: PreviewTeam,
  integrations: PreviewIntegrations,
  finish: PreviewFinish,
}

export function OnboardingSlidePreviews({ previewId }: { previewId: OnboardingWizardPreviewId }) {
  const Preview = PREVIEWS[previewId]
  return (
    <div className="flex h-full min-h-[240px] w-full items-center justify-center p-2">
      <div className="w-full max-w-md">
        <Preview />
      </div>
    </div>
  )
}
