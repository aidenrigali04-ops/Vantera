'use client'

import { AgentAnalyticsPanel } from '@/components/agents/AgentAnalyticsPanel'
import { AgentCapabilityCard } from '@/components/agents/AgentCapabilityCard'
import { AgentConfigSection } from '@/components/agents/AgentConfigSection'
import {
  AgentFormField,
  agentInputClassName,
  agentTextareaClassName,
} from '@/components/agents/AgentFormField'
import { AgentWorkspaceLayout } from '@/components/agents/AgentWorkspaceLayout'
import { OutreachAgentActivityFeed } from '@/components/outreach-agent/OutreachAgentActivityFeed'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
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
import { Textarea } from '@/components/ui/textarea'
import { AGENT_DEFAULT_INSTRUCTIONS, AGENT_PAGE_COPY } from '@/lib/agents/default-instructions'
import { createOutreachCampaign } from '@/lib/outreach/actions'
import type {
  CampaignWithStats,
  OutreachCampaignGoal,
} from '@/lib/outreach/types'
import { CAMPAIGN_GOAL_LABELS } from '@/lib/outreach/types'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import type {
  OutreachAgentConfig,
  OutreachAgentDashboardStats,
  OutreachAgentUpcomingStep,
} from '@/lib/outreach-agent/types'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import { cn } from '@/lib/utils'
import { Link2, Mail, Megaphone, MessageCircle, Plus, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  mode: 'setup' | 'configured'
  config: OutreachAgentConfig | null
  stats: OutreachAgentDashboardStats | null
  linkedCampaigns: CampaignWithStats[]
  allCampaigns: CampaignWithStats[]
  upcoming: OutreachAgentUpcomingStep[]
  initialActivity: SDRActivityEvent[]
  accountId: string
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

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function OutreachAgentWorkspace({
  mode,
  config,
  stats,
  linkedCampaigns,
  allCampaigns,
  upcoming,
  initialActivity,
  accountId,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [activity, setActivity] = useState(initialActivity)
  const [campaigns, setCampaigns] = useState(allCampaigns)
  const copy = AGENT_PAGE_COPY.outreach_agent

  const [agentName, setAgentName] = useState(config?.agentName ?? copy.defaultName)
  const [agentDescription, setAgentDescription] = useState(copy.defaultDescription)
  const [instructions, setInstructions] = useState(AGENT_DEFAULT_INSTRUCTIONS.outreach_agent)
  const [conversationStarters, setConversationStarters] = useState(
    'Send all overdue steps for active sequences now\nShow me the reply rate across campaigns this week\nPause outreach for leads that haven\'t engaged in 14 days',
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(config?.linkedCampaignIds ?? [])
  const [queueEnabled, setQueueEnabled] = useState(true)
  const [linkedinManual, setLinkedinManual] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignGoal, setNewCampaignGoal] = useState<OutreachCampaignGoal>('book_meeting')

  useEffect(() => {
    if (searchParams.get('setup') !== 'complete') return
    toast.message(`${agentName} is live — outreach activity appears in analytics`, {
      duration: 5000,
    })
    router.replace('/admin/outreach/agents/outreach')
  }, [agentName, router, searchParams])

  const refreshActivity = useCallback(async () => {
    const res = await fetch('/api/outreach-agent/activity?limit=50')
    const json = await res.json()
    if (json.success) setActivity(json.data)
  }, [])

  const { isLive: activityLive } = useAccountRealtime({
    accountId,
    table: 'sdr_activity_log',
    onChange: refreshActivity,
    enabled: mode === 'configured',
  })

  const statusLabel = config?.isPaused ? 'Paused' : config?.isActive ? 'Active' : 'Inactive'
  const statusTone = config?.isPaused ? 'warning' : config?.isActive ? 'success' : 'neutral'

  const aggregateMetrics = useMemo(
    () =>
      linkedCampaigns.reduce(
        (acc, campaign) => {
          acc.sent += campaign.metrics.sent
          acc.replied += campaign.metrics.replied
          acc.meetings += campaign.metrics.meetings
          return acc
        },
        { sent: 0, replied: 0, meetings: 0 },
      ),
    [linkedCampaigns],
  )

  const analyticsKpis = stats
    ? [
        { label: 'Linked', value: stats.linkedCampaigns },
        { label: 'Active', value: stats.activeCampaigns },
        { label: 'Sent today', value: stats.sentToday },
        { label: 'Replies (7d)', value: stats.repliesThisWeek },
      ]
    : [
        { label: 'Linked', value: '—' },
        { label: 'Active', value: '—' },
        { label: 'Sent today', value: '—' },
        { label: 'Replies (7d)', value: '—' },
      ]

  function toggleCampaign(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function deploy() {
    if (!agentName.trim()) {
      toast.error('Enter an agent name')
      return
    }
    if (selectedIds.length === 0) {
      toast.error('Link at least one campaign')
      return
    }

    if (mode === 'setup') {
      startTransition(async () => {
        const toastId = toast.loading('Deploying Outreach Agent…')
        try {
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
            toast.error(json.error ?? 'Could not deploy agent', { id: toastId })
            return
          }
          toast.success(`${agentName.trim()} deployed — linked campaigns are live`, { id: toastId })
          router.push('/admin/outreach/agents/outreach?setup=complete')
          router.refresh()
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Deploy failed — check your connection and try again',
            { id: toastId },
          )
        }
      })
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/outreach-agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          agentName: agentName.trim(),
          linkedCampaignIds: selectedIds,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not save changes')
        return
      }
      toast.success('Outreach Agent updated')
      router.refresh()
    })
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

  const configPanel = (
    <>
      <AgentConfigSection title="Agent Identity">
        <AgentFormField id="outreach-name" label="Name">
          <Input
            id="outreach-name"
            className={agentInputClassName}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="outreach-description" label="Description">
          <Input
            id="outreach-description"
            className={agentInputClassName}
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
          />
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Instructions System">
        <AgentFormField id="outreach-instructions" label="Instruction">
          <Textarea
            id="outreach-instructions"
            rows={7}
            className={cn(agentTextareaClassName, 'font-mono')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </AgentFormField>
        <AgentFormField id="outreach-starters" label="Conversation starters">
          <Textarea
            id="outreach-starters"
            rows={3}
            placeholder="One starter per line…"
            className={agentTextareaClassName}
            value={conversationStarters}
            onChange={(e) => setConversationStarters(e.target.value)}
          />
        </AgentFormField>
      </AgentConfigSection>

      <AgentConfigSection title="Capabilities">
        <div className="space-y-3">
          <AgentCapabilityCard
            icon={Zap}
            title="Scheduled queue processing"
            description="Process due email and SMS steps during outreach windows."
            checked={queueEnabled}
            onCheckedChange={setQueueEnabled}
          />
          <AgentCapabilityCard
            icon={Link2}
            title="Manual LinkedIn approval"
            description="LinkedIn steps always wait for human approval before marking sent."
            checked={linkedinManual}
            onCheckedChange={setLinkedinManual}
            disabled
          />
          <AgentCapabilityCard
            icon={Megaphone}
            title="Multi-channel sequences"
            description="Orchestrate email, SMS, and LinkedIn from linked campaigns."
            checked
            onCheckedChange={() => {}}
            disabled
          />
        </div>
      </AgentConfigSection>

      <AgentConfigSection
        title="Linked campaigns"
        description="Campaigns this agent orchestrates. Changes apply on save."
      >
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Create campaign
          </Button>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-[13px] text-[var(--text-secondary)]">No campaigns yet. Create one to link it here.</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((campaign) => {
              const checked = selectedIds.includes(campaign.id)
              return (
                <label
                  key={campaign.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 transition-colors duration-[120ms]',
                    checked && 'border-[var(--accent-border)] bg-[var(--accent-muted)]/25',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleCampaign(campaign.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {campaign.name}
                      </span>
                      <StatusBadge
                        label={campaign.status}
                        tone={campaignStatusTone(campaign.status)}
                      />
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {CAMPAIGN_GOAL_LABELS[campaign.goal]} · {campaign.metrics.enrolled} enrolled ·{' '}
                      {campaign.metrics.sent} sent
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </AgentConfigSection>
    </>
  )

  const analyticsPanel = (
    <AgentAnalyticsPanel live={mode === 'configured' && activityLive} kpis={analyticsKpis}>
      {mode === 'configured' ? (
        <div className="space-y-6">
          <dl className="grid grid-cols-3 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-4 text-[12px]">
            <div>
              <dt className="text-[var(--text-tertiary)]">Sent</dt>
              <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{aggregateMetrics.sent}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-tertiary)]">Replied</dt>
              <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{aggregateMetrics.replied}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-tertiary)]">Meetings</dt>
              <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{aggregateMetrics.meetings}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Activity</h3>
            <OutreachAgentActivityFeed events={activity} />
          </div>

          <div>
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Upcoming sends</h3>
            {upcoming.length === 0 ? (
              <p className="text-[13px] text-[var(--text-secondary)]">Nothing scheduled in the next 7 days.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 5).map((row) => (
                  <li
                    key={row.step.id}
                    className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px]"
                  >
                    {row.step.channel === 'sms' ? (
                      <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
                    ) : (
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">
                        {formatTime(row.step.sendAt)} · {row.campaignName}
                      </p>
                      <p className="truncate text-[var(--text-secondary)]">
                        {[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Prospect'}, {row.company}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] shadow-[var(--shadow-sm)]">
            <Megaphone className="h-7 w-7 text-[var(--accent)]" aria-hidden />
          </span>
          <p className="mt-5 text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Analytics activate after deploy
          </p>
          <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Link campaigns, then deploy to see send volume, replies, and queue activity here.
          </p>
        </div>
      )}
    </AgentAnalyticsPanel>
  )

  return (
    <>
      <AgentWorkspaceLayout
        title={copy.title}
        subtitle={copy.subtitle}
        statusLabel={mode === 'configured' ? statusLabel : undefined}
        statusTone={statusTone}
        onDeploy={deploy}
        deployLabel={mode === 'setup' ? 'Deploy' : 'Save changes'}
        deployLoading={isPending}
        deployDisabled={!agentName.trim() || selectedIds.length === 0}
        config={configPanel}
        analytics={analyticsPanel}
        footer={
          mode === 'configured' && linkedCampaigns.length > 0 ? (
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-sm)]">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Linked campaign performance
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {linkedCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-lg border border-[var(--border-subtle)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{campaign.name}</p>
                      <Button variant="ghost" size="sm" className="h-7 text-[12px]" asChild>
                        <Link href={`/admin/outreach/campaigns/${campaign.id}`}>Open</Link>
                      </Button>
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                      {campaign.metrics.sent} sent · {campaign.metrics.replied} replied ·{' '}
                      {campaign.metrics.meetings} meetings
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-campaign-name">Name</Label>
              <Input
                id="new-campaign-name"
                className="mt-1.5"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>
            <div>
              <Label>Goal</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {GOALS.map((goal) => (
                  <Button
                    key={goal}
                    type="button"
                    size="sm"
                    variant={newCampaignGoal === goal ? 'default' : 'outline'}
                    onClick={() => setNewCampaignGoal(goal)}
                  >
                    {CAMPAIGN_GOAL_LABELS[goal]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || !newCampaignName.trim()} onClick={handleCreateCampaign}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
