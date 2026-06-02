'use client'

import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
import { SdrWizardMediaPanel } from '@/components/sdr/SdrWizardMediaPanel'
import type { Plan } from '@/lib/feature-flags/flags'
import { Radar, Shield, Sparkles, Target, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const CAPABILITIES = [
  {
    icon: Radar,
    title: 'Prospect Scout',
    description: 'Finds ICP-matched leads on your schedule via live discovery.',
  },
  {
    icon: Target,
    title: 'ICP scoring',
    description: 'Scores every discovery against your vertical and minimum ICP floor.',
  },
  {
    icon: Sparkles,
    title: 'Pipeline-ready',
    description: 'Qualified prospects land in your pipeline automatically.',
  },
  {
    icon: Zap,
    title: 'Always on',
    description: 'Runs daily or weekly with pause/resume from the command center.',
  },
] as const

type Props = {
  isOwner: boolean
  plan: Plan
  onActivated: () => void
}

export function SdrModuleActivationClient({ isOwner, plan, onActivated }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const slide = {
    id: 'activate',
    eyebrow: 'Prospecting agent',
    title: 'Activate autonomous prospecting',
    body: 'Turn on Prospect Scout, configure your ICP in five steps, and start filling pipeline automatically.',
  }

  function handleActivate() {
    if (!isOwner) {
      toast.error('Only account owners can activate the prospecting agent')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/sdr/activate', { method: 'POST', credentials: 'same-origin' })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (!json.success) {
        setError(json.error ?? 'Could not activate prospecting agent')
        toast.error(json.error ?? 'Activation failed')
        return
      }
      toast.success('Prospecting agent activated — continue setup')
      onActivated()
      router.refresh()
    })
  }

  return (
    <SlideWizardFrame
      variant="fullscreen"
      headerLabel="Prospecting agent · Activate"
      slide={slide}
      stepIndex={0}
      totalSteps={1}
      mediaPanel={
        <SdrWizardMediaPanel
          media={{ type: 'preview', previewId: 'scout' }}
          slideId="activate"
          className="h-full min-h-[240px]"
        />
      }
      onBack={() => router.push('/admin/outreach/agents')}
      onPrimary={handleActivate}
      primaryLabel={isPending ? 'Activating…' : 'Activate & continue setup'}
      primaryDisabled={!isOwner || isPending}
      primaryLoading={isPending}
      showSkip={false}
      dialogTitleId="sdr-activate-title"
      dialogBodyId="sdr-activate-body"
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isOwner ? (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-3 py-2.5 text-[13px] text-[var(--text-primary)]">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
            <p>Ask your account owner to activate the prospecting agent, then return here to finish setup.</p>
          </div>
        ) : plan === 'team' ? (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)]">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
            <p>
              Included on your Team plan. Activation enables Prospect Scout discovery for this
              workspace — outreach sequences are configured separately.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SlideWizardFrame>
  )
}
