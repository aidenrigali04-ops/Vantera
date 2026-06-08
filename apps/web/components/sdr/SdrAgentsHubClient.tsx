'use client'

import { AgentDetailShell } from '@/components/agents/AgentDetailShell'
import { AgentScenarioCard } from '@/components/agents/AgentScenarioCard'
import { AgentSidebarPanel, DEFAULT_SDR_CONNECTED_APPS } from '@/components/agents/AgentSidebarPanel'
import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { AgentsAutomationSection } from '@/components/sdr/AgentsAutomationSection'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { SdrActivityFeed } from '@/components/sdr/activity-feed'
import { Button } from '@/components/ui/button'
import type { SdrAgentCard, SdrAgentId, SdrAgentSnapshot } from '@/lib/agents/types'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { isAutomaticOutreachMode } from '@/lib/sdr/outreach-automation-mode'
import type { HubAgentConfigSummary } from '@/lib/agents/serialize'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import { ArrowRight, Bot, Pause, Play, Radar } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  agents: SdrAgentCard[]
  snapshot: SdrAgentSnapshot
  enrolledLeads: number
  sdrEnabled: boolean
  outreachAutomationMode: OutreachAutomationMode
  sdrConfigured: boolean
  config: HubAgentConfigSummary | null
  initialActivity: SDRActivityEvent[]
  accountId: string
}

type TabId = 'scenarios' | 'approvals' | 'runs' | 'settings'

const STATUS_TONE = {
  active: 'success',
  inactive: 'warning',
  idle: 'neutral',
  needs_setup: 'warning',
} as const

const STATUS_LABEL = {
  active: 'Active',
  inactive: 'Inactive',
  idle: 'Standby',
  needs_setup: 'Configure',
} as const

const PIPELINE: {
  id: SdrAgentId
  scenarioTitle: string
  schedule: string
  steps: string
}[] = [
  {
    id: 'prospect_scout',
    scenarioTitle: 'ICP lead discovery',
    schedule: 'Daily · scheduled discovery',
    steps: '3 steps',
  },
  {
    id: 'message_drafter',
    scenarioTitle: 'Personalized copy drafting',
    schedule: 'On demand · when leads arrive',
    steps: '2 steps',
  },
  {
    id: 'outreach_agent',
    scenarioTitle: 'Multi-channel outreach',
    schedule: 'Per outreach window',
    steps: '5 steps',
  },
  {
    id: 'pipeline_analyst',
    scenarioTitle: 'Pipeline interest scoring',
    schedule: 'Daily · engagement scoring',
    steps: '1 step',
  },
]

function agentHref(agent: SdrAgentCard): string {
  if (agent.id === 'prospect_scout') {
    return agent.status === 'needs_setup'
      ? '/admin/outreach/agents/setup'
      : '/admin/outreach/agents/scout'
  }
  if (agent.id === 'outreach_agent') {
    return agent.status === 'needs_setup'
      ? '/admin/outreach/agents/outreach'
      : '/admin/outreach/agents/outreach'
  }
  if (agent.id === 'message_drafter') {
    return '/admin/outreach/agents/drafter'
  }
  if (agent.id === 'pipeline_analyst') {
    return '/admin/outreach/agents/analyst'
  }
  return agent.href
}

function discoveryScheduleLabel(config: HubAgentConfigSummary | null): string {
  if (!config) return 'Daily · scheduled discovery'
  const freq = config.searchFrequency === 'weekly' ? 'Weekly' : 'Daily'
  const hour = config.outreachWindow.startHour
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 || 12
  return `${freq} · ${String(h12).padStart(2, '0')}:00 ${ampm}`
}

function pendingLabel(agent: SdrAgentCard, snapshot: SdrAgentSnapshot): string | undefined {
  if (agent.id === 'message_drafter' && snapshot.pendingDrafts > 0) {
    return `Pending: ${snapshot.pendingDrafts} draft${snapshot.pendingDrafts === 1 ? '' : 's'}`
  }
  if (agent.id === 'outreach_agent' && snapshot.pendingLinkedInDrafts > 0) {
    return `Pending: ${snapshot.pendingLinkedInDrafts} LinkedIn`
  }
  if (agent.status === 'needs_setup') {
    return 'Needs setup'
  }
  return undefined
}

export function SdrAgentsHubClient({
  agents,
  snapshot,
  enrolledLeads,
  sdrEnabled,
  outreachAutomationMode,
  sdrConfigured,
  config,
  initialActivity,
  accountId,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('scenarios')
  const [activity, setActivity] = useState(initialActivity)
  const [isPending, startTransition] = useTransition()

  const automatic = isAutomaticOutreachMode(outreachAutomationMode)
  const byId = new Map(agents.map((a) => [a.id, a]))
  const pipeline = PIPELINE.map((p) => ({ ...p, agent: byId.get(p.id) })).filter(
    (p): p is (typeof PIPELINE)[number] & { agent: SdrAgentCard } => Boolean(p.agent),
  )

  const reviewCount = snapshot.pendingDrafts + snapshot.pendingLinkedInDrafts
  const agentTitle = config?.agentName ?? 'SDR Agent'
  const isRunning = Boolean(config?.isActive && !config?.isPaused)

  const refreshActivity = useCallback(async () => {
    const res = await fetch('/api/sdr/activity?limit=50')
    const json = await res.json()
    if (json.success) setActivity(json.data)
  }, [])

  const { isLive: activityLive } = useAccountRealtime({
    accountId,
    table: 'sdr_activity_log',
    onChange: refreshActivity,
    enabled: sdrConfigured,
  })

  async function handleRunNow() {
    startTransition(async () => {
      const res = await fetch('/api/sdr/bootstrap', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Run failed')
        return
      }
      toast.success('Discovery run queued')
      router.refresh()
      await refreshActivity()
    })
  }

  function handlePauseResume() {
    if (!config) return
    startTransition(async () => {
      const url = config.isPaused ? '/api/sdr/config/resume' : '/api/sdr/config/pause'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: config.isPaused ? undefined : JSON.stringify({ reason: 'Paused from agent dashboard' }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Action failed')
        return
      }
      toast.success(config.isPaused ? 'Agent resumed' : 'Agent paused')
      router.refresh()
    })
  }

  if (!sdrEnabled) {
    return (
      <AdminPageContent>
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
          <p className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
            <Bot className="h-3.5 w-3.5" aria-hidden />
            SDR Agent
          </p>
          <h1 className="mt-3 max-w-xl text-[28px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Put your pipeline on autopilot
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
            One autonomous agent that finds ICP-matched leads, drafts personalized outreach, runs
            sequences, and scores who needs attention next — without adding headcount.
          </p>
          <Button
            asChild
            className="mt-6 bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
          >
            <Link href="/admin/outreach/agents/setup">
              Get started
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </section>
      </AdminPageContent>
    )
  }

  return (
    <AdminPageContent>
      <AgentDetailShell
        breadcrumbs={[{ label: 'Agents' }]}
        title={agentTitle}
        description="Monitors your pipeline, drafts personalized outreach, and runs multi-channel sequences on schedule — so your team focuses on closing."
        reviewBadge={reviewCount > 0 ? `${reviewCount} to review` : undefined}
        actions={
          sdrConfigured ? (
            <>
              <Button variant="outline" size="sm" disabled={isPending} onClick={handleRunNow}>
                <Radar className="mr-1.5 h-4 w-4" aria-hidden />
                Run now
              </Button>
              <Button
                size="sm"
                disabled={isPending || !config}
                onClick={handlePauseResume}
                className="bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
              >
                {config?.isPaused ? (
                  <>
                    <Play className="mr-1.5 h-4 w-4" aria-hidden /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-1.5 h-4 w-4" aria-hidden /> Pause
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              asChild
              size="sm"
              className="bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
            >
              <Link href="/admin/outreach/agents/setup">Set up agent</Link>
            </Button>
          )
        }
        tabs={[
          { id: 'scenarios', label: 'Scenarios', badge: pipeline.length, badgeTone: 'accent' },
          {
            id: 'approvals',
            label: 'Approvals',
            badge: reviewCount || undefined,
            badgeTone: 'review',
          },
          { id: 'runs', label: 'Runs', badge: activity.length || undefined },
          { id: 'settings', label: 'Settings' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        sidebar={
          <AgentSidebarPanel
            instructions="Your SDR agent runs as a coordinated pipeline: discover and score leads, draft personalized copy for review, deliver multi-channel sequences, and flag high-intent prospects. Keep ICP rules accurate and review pending drafts daily for best results."
            connectedApps={DEFAULT_SDR_CONNECTED_APPS}
          />
        }
      >
        {activeTab === 'scenarios' ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Configured scenarios
                </h2>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  {isRunning ? 'Running' : config?.isPaused ? 'Paused' : 'Standby'} · {enrolledLeads}{' '}
                  in sequences
                </p>
              </div>
              <Button
                asChild
                size="sm"
                className="bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
              >
                <Link href="/admin/outreach/agents/setup">New scenario</Link>
              </Button>
            </div>

            <div className="space-y-3">
              {pipeline.map((p) => {
                const agent = p.agent
                const href = agentHref(agent)
                const schedule =
                  p.id === 'prospect_scout'
                    ? discoveryScheduleLabel(config)
                    : p.id === 'outreach_agent' && automatic
                      ? 'Automatic · after each discovery run'
                      : p.schedule

                return (
                  <AgentScenarioCard
                    key={p.id}
                    title={p.scenarioTitle}
                    description={agent.description}
                    statusLabel={STATUS_LABEL[agent.status]}
                    statusTone={STATUS_TONE[agent.status]}
                    schedule={schedule}
                    stepsLabel={p.steps}
                    lastRun={`${agent.statLabel}: ${agent.statValue}`}
                    pendingLabel={pendingLabel(agent, snapshot)}
                    menuItems={[
                      {
                        label: agent.status === 'needs_setup' ? 'Configure' : 'Open details',
                        href,
                      },
                    ]}
                  />
                )
              })}
            </div>
          </section>
        ) : null}

        {activeTab === 'approvals' ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Pending approvals
              </h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                Review drafts and manual sends before they go out.
              </p>
            </div>

            <div className="space-y-3">
              <AgentScenarioCard
                title="Email & SMS drafts"
                description="Personalized copy waiting for your review before send."
                statusLabel={snapshot.pendingEmailDrafts > 0 ? 'Review' : 'Clear'}
                statusTone={snapshot.pendingEmailDrafts > 0 ? 'warning' : 'success'}
                pendingLabel={
                  snapshot.pendingEmailDrafts > 0
                    ? `Pending: ${snapshot.pendingEmailDrafts} draft${snapshot.pendingEmailDrafts === 1 ? '' : 's'}`
                    : undefined
                }
                menuItems={[{ label: 'Open drafter', href: '/admin/outreach/agents/drafter' }]}
              />
              <AgentScenarioCard
                title="LinkedIn manual sends"
                description="Connection requests and messages queued for manual delivery via the LinkedIn add-on."
                statusLabel={snapshot.pendingLinkedInDrafts > 0 ? 'Review' : 'Clear'}
                statusTone={snapshot.pendingLinkedInDrafts > 0 ? 'warning' : 'success'}
                pendingLabel={
                  snapshot.pendingLinkedInDrafts > 0
                    ? `Pending: ${snapshot.pendingLinkedInDrafts} step${snapshot.pendingLinkedInDrafts === 1 ? '' : 's'}`
                    : undefined
                }
                menuItems={[
                  { label: 'Open drafter', href: '/admin/outreach/agents/drafter' },
                  { label: 'LinkedIn hub', href: '/admin/outreach/linkedin' },
                ]}
              />
            </div>
          </section>
        ) : null}

        {activeTab === 'runs' ? (
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Run history</h2>
              <LiveIndicator active={activityLive} />
            </div>
            {sdrConfigured ? (
              <SdrActivityFeed events={activity} accountId={accountId} />
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)]">
                Complete setup to start logging agent runs.
              </p>
            )}
          </section>
        ) : null}

        {activeTab === 'settings' ? (
          <section className="space-y-6">
            {sdrConfigured ? (
              <AgentsAutomationSection
                initialMode={outreachAutomationMode}
                sdrConfigured={sdrConfigured}
              />
            ) : null}

            <div className="space-y-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Configuration
              </h2>
              {pipeline.map((p) => {
                const agent = p.agent
                return (
                  <AgentScenarioCard
                    key={p.id}
                    title={agent.name}
                    description={agent.tagline}
                    statusLabel={STATUS_LABEL[agent.status]}
                    statusTone={STATUS_TONE[agent.status]}
                    menuItems={[{ label: 'Configure', href: agentHref(agent) }]}
                  />
                )
              })}
            </div>
          </section>
        ) : null}
      </AgentDetailShell>
    </AdminPageContent>
  )
}
