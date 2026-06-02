'use client'

import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
import { SdrWizardMediaPanel } from '@/components/sdr/SdrWizardMediaPanel'
import { Button } from '@/components/ui/button'
import type { Plan } from '@/lib/feature-flags/flags'
import { Clock, Mail, Radar, Shield, Sparkles, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const CAPABILITIES = [
  {
    icon: Radar,
    title: 'Prospect Scout',
    description: 'Finds ICP-matched leads daily via Apify and Aspire saved searches.',
  },
  {
    icon: Mail,
    title: 'Outreach sequences',
    description: 'Drafts and sends multi-step email and SMS nurture on your schedule.',
  },
  {
    icon: Sparkles,
    title: 'Message Drafter',
    description: 'AI rewrites every touchpoint in your brand voice before send.',
  },
  {
    icon: Clock,
    title: 'Always on',
    description: 'Runs 24/7 with pause/resume control from the command center.',
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
    eyebrow: 'SDR Agents',
    title: 'Deploy a 24/7 sales development rep',
    body: 'Activate the module, configure your agent in five steps, and start filling pipeline automatically.',
  }

  function handleActivate() {
    if (!isOwner) {
      toast.error('Only account owners can activate SDR Agents')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/sdr/activate', { method: 'POST' })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (!json.success) {
        setError(json.error ?? 'Could not activate SDR Agents')
        toast.error(json.error ?? 'Activation failed')
        return
      }
      toast.success('SDR Agents activated — continue setup')
      onActivated()
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[var(--bg-base)] p-4 sm:p-6">
      <SlideWizardFrame
        variant="page"
        headerLabel="SDR Agents · Activate module"
        slide={slide}
        stepIndex={0}
        totalSteps={1}
        mediaPanel={
          <SdrWizardMediaPanel
            media={{ type: 'preview', previewId: 'launch' }}
            slideId="activate"
            className="h-full lg:min-h-[320px]"
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
              <p>Ask your account owner to activate SDR Agents, then return here to complete setup.</p>
            </div>
          ) : plan === 'team' ? (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)]">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
              <p>
                Included on your Team plan. Activation enables Prospect Scout, sequences, and the
                agent command center for this workspace.
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

      {!isOwner ? (
        <div className="mx-auto mt-4 max-w-[880px] text-center">
          <Button
            variant="outline"
            className="border-[var(--border-default)]"
            onClick={() => router.push('/admin/outreach/agents')}
          >
            Back to SDR Agents
          </Button>
        </div>
      ) : null}
    </div>
  )
}
