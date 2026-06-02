'use client'

import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { createOutreachCampaign } from '@/lib/outreach/actions'
import {
  CAMPAIGN_GOAL_LABELS,
  type CampaignWithStats,
  type OutreachCampaignGoal,
} from '@/lib/outreach/types'
import {
  getOutreachAgentWizardSlideMeta,
  OUTREACH_AGENT_WIZARD_SLIDES,
} from '@/lib/onboarding/outreach-agent-wizard-slides'
import { cn } from '@/lib/utils'
import { Link2, Megaphone, Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  initialCampaigns: CampaignWithStats[]
}

const GOALS: OutreachCampaignGoal[] = ['book_meeting', 'fill_funnel', 're_engage']

function campaignStatusTone(status: CampaignWithStats['status']) {
  switch (status) {
    case 'active':
      return 'success' as const
    case 'draft':
      return 'neutral' as const
    case 'paused':
      return 'warning' as const
    default:
      return 'neutral' as const
  }
}

function WizardMediaPanel({ slideId }: { slideId: string }) {
  const items =
    slideId === 'campaigns'
      ? ['Pick any existing campaign', 'Link multiple at once', 'Edit campaigns anytime']
      : slideId === 'review'
        ? ['Linked campaigns stay in your library', 'Queue activity in one place', 'Pause without deleting']
        : slideId === 'launch'
          ? ['Scheduled sends keep running', 'Manual LinkedIn steps surface here', 'Run queue on demand']
          : ['Email, SMS, and LinkedIn', 'Multi-step sequences', '24/7 orchestration']

  return (
    <div className="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 p-6">
      <div className="space-y-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)]">
          <Megaphone className="h-5 w-5 text-[var(--text-primary)]" />
        </span>
        <p className="text-sm font-medium text-[var(--text-primary)]">Outreach Agent</p>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Orchestrate campaigns you already built — no duplicate setup required.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((label) => (
          <li
            key={label}
            className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OutreachAgentSetupWizardClient({ initialCampaigns }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [agentName, setAgentName] = useState('Outreach Agent')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignGoal, setNewCampaignGoal] = useState<OutreachCampaignGoal>('book_meeting')

  const slide = OUTREACH_AGENT_WIZARD_SLIDES[step]!
  const { total, isFirst, isLast } = getOutreachAgentWizardSlideMeta(step)

  const selectedCampaigns = useMemo(
    () => campaigns.filter((campaign) => selectedIds.includes(campaign.id)),
    [campaigns, selectedIds],
  )

  function toggleCampaign(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function validateStep(targetStep = step): boolean {
    if (targetStep === 0 && !agentName.trim()) {
      toast.error('Enter a name for your outreach agent')
      return false
    }
    if (targetStep === 1 && selectedIds.length === 0) {
      toast.error('Link at least one campaign to continue')
      return false
    }
    return true
  }

  function validateAllSteps(): boolean {
    for (let index = 0; index < OUTREACH_AGENT_WIZARD_SLIDES.length - 1; index += 1) {
      if (!validateStep(index)) return false
    }
    return true
  }

  function handlePrimary() {
    if (isLast) {
      if (!validateAllSteps()) return
      launch()
      return
    }
    if (!validateStep()) return
    setStep((current) => current + 1)
  }

  function handleCreateCampaign() {
    startTransition(async () => {
      const result = await createOutreachCampaign({
        name: newCampaignName,
        goal: newCampaignGoal,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }

      const created: CampaignWithStats = {
        id: result.data!.id,
        accountId: '',
        name: newCampaignName.trim() || 'Untitled campaign',
        goal: newCampaignGoal,
        status: 'draft',
        channels: ['email'],
        workflow: { steps: [] },
        metrics: { enrolled: 0, sent: 0, failed: 0, replied: 0, meetings: 0 },
        ownerId: null,
        launchedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      setCampaigns((current) => [created, ...current])
      setSelectedIds((current) => [...current, created.id])
      setCreateOpen(false)
      setNewCampaignName('')
      toast.success('Campaign created and linked')
    })
  }

  function launch() {
    startTransition(async () => {
      const res = await fetch('/api/outreach-agent/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          agentName: agentName.trim(),
          linkedCampaignIds: selectedIds,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not activate Outreach Agent')
        return
      }

      toast.success(`${agentName.trim()} is live — linked to ${selectedIds.length} campaign${selectedIds.length === 1 ? '' : 's'}`)
      router.push('/admin/outreach/agents/outreach?setup=complete')
      router.refresh()
    })
  }

  return (
    <>
      <SlideWizardFrame
        variant="fullscreen"
        headerLabel="Outreach agent setup"
        slide={slide}
        stepIndex={step}
        totalSteps={total}
        mediaPanel={<WizardMediaPanel slideId={slide.id} />}
        onBack={() => setStep((current) => Math.max(0, current - 1))}
        onPrimary={handlePrimary}
        primaryLabel={isLast ? 'Activate agent' : 'Continue'}
        primaryLoading={isPending}
        showSkip={false}
      >
        {slide.id === 'identity' ? (
          <div className="space-y-2">
            <Label htmlFor="outreach-agent-name">Agent name</Label>
            <Input
              id="outreach-agent-name"
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              placeholder="Outreach Agent"
              className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
        ) : null}

        {slide.id === 'campaigns' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Select campaigns this agent should orchestrate. You can change links later from the command center.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create campaign
              </Button>
            </div>

            {campaigns.length === 0 ? (
              <div className="card-surface border-dashed p-6 text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                  No campaigns yet. Create one here to link it without leaving setup.
                </p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create your first campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map((campaign) => {
                  const checked = selectedIds.includes(campaign.id)
                  return (
                    <label
                      key={campaign.id}
                      className={cn(
                        'card-surface flex cursor-pointer items-start gap-3 p-4',
                        checked && 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]/50',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCampaign(campaign.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{campaign.name}</span>
                          <StatusBadge
                            label={campaign.status}
                            tone={campaignStatusTone(campaign.status)}
                          />
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {CAMPAIGN_GOAL_LABELS[campaign.goal]} · {campaign.metrics.enrolled} enrolled ·{' '}
                          {campaign.metrics.sent} sent
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}

        {slide.id === 'review' || slide.id === 'launch' ? (
          <div className="space-y-4">
            <div className="card-surface p-4">
              <p className="text-sm text-[var(--text-secondary)]">Agent name</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{agentName.trim()}</p>
            </div>
            <div className="card-surface p-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {selectedCampaigns.length} linked campaign{selectedCampaigns.length === 1 ? '' : 's'}
                </p>
              </div>
              <ul className="mt-3 space-y-2">
                {selectedCampaigns.map((campaign) => (
                  <li key={campaign.id} className="text-sm text-[var(--text-secondary)]">
                    {campaign.name} · {CAMPAIGN_GOAL_LABELS[campaign.goal]} · {campaign.status}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </SlideWizardFrame>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={newCampaignName}
                onChange={(event) => setNewCampaignName(event.target.value)}
                placeholder="Q2 outbound"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Campaign goal</Label>
              <div className="mt-2 grid gap-2">
                {GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setNewCampaignGoal(goal)}
                    className={cn(
                      'rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm',
                      newCampaignGoal === goal
                        ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                        : 'border-[var(--border-default)]',
                    )}
                  >
                    {CAMPAIGN_GOAL_LABELS[goal]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || !newCampaignName.trim()} onClick={handleCreateCampaign}>
              Create and link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
