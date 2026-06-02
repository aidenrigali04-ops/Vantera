'use client'

import type { SDRActivityEvent, SDRAgentConfig, SDRDashboardStats } from '@/lib/sdr/types'
import { SdrCreditPaywall } from '@/components/sdr/SdrCreditPaywall'
import { SdrCreditStrip } from '@/components/sdr/SdrCreditStrip'
import { SdrOutreachHubTabs } from '@/components/sdr/SdrOutreachHubTabs'
import { useSdrCredits } from '@/lib/sdr/use-sdr-credits'
import { cn } from '@/lib/utils'
import {
  Bot,
  Calendar,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Settings,
  Users,
  Radar,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { SdrActivityFeed } from '@/components/sdr/activity-feed'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'

type UpcomingSend = {
  step: { id: string; stepNumber: number; channel: string; scheduledFor: Date }
  firstName: string | null
  lastName: string | null
  company: string
}

type Props = {
  config: SDRAgentConfig
  stats: SDRDashboardStats
  initialActivity: SDRActivityEvent[]
  upcoming: UpcomingSend[]
  autonomousMessaging?: boolean
  /** Render inside the agents hub without duplicate page chrome. */
  embedded?: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function SdrCommandCenterClient({
  config,
  stats,
  initialActivity,
  upcoming,
  autonomousMessaging = true,
  embedded = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [activity, setActivity] = useState(initialActivity)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const {
    credits,
    exhausted,
    isLoading: creditsLoading,
    startTrial,
    refreshCredits,
  } = useSdrCredits(true)

  useEffect(() => {
    if (exhausted) setPaywallOpen(true)
  }, [exhausted])

  useEffect(() => {
    if (searchParams.get('setup') !== 'complete') return
    toast.message(`${config.agentName} is live — discovery activity appears below`, {
      duration: 5000,
    })
    router.replace('/admin/outreach/agents/scout')
  }, [config.agentName, router, searchParams])

  const refreshActivity = useCallback(async () => {
    const res = await fetch('/api/sdr/activity?limit=50')
    const json = await res.json()
    if (json.success) setActivity(json.data)
  }, [])

  const { isLive: activityLive } = useAccountRealtime({
    accountId: config.accountId,
    table: 'sdr_activity_log',
    onChange: refreshActivity,
  })

  const statusLabel = config.isPaused
    ? 'Paused'
    : config.isActive
      ? 'Running'
      : 'Inactive'

  const statusTone = config.isPaused
    ? 'text-[var(--warning)]'
    : config.isActive
      ? 'text-[var(--success)]'
      : 'text-[var(--text-secondary)]'

  async function handleRunDiscovery() {
    startTransition(async () => {
      const res = await fetch('/api/sdr/bootstrap', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Discovery run failed')
        return
      }
      if (json.data?.queued) {
        toast.success('Discovery run started — Prospect Scout is now active')
        router.refresh()
        await refreshActivity()
        return
      }
      const enrolled = json.data?.enrolled ?? 0
      const found = json.data?.found ?? 0
      toast.success(
        enrolled > 0
          ? `Added ${enrolled} prospect${enrolled === 1 ? '' : 's'} to pipeline`
          : found > 0
            ? `Scored ${found} prospects (none met ICP floor)`
            : 'Discovery run finished — no new matches',
      )
      router.refresh()
      await refreshActivity()
    })
  }

  function handlePauseResume() {
    startTransition(async () => {
      const url = config.isPaused ? '/api/sdr/config/resume' : '/api/sdr/config/pause'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: config.isPaused ? undefined : JSON.stringify({ reason: 'Paused from dashboard' }),
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

  function handleSendNow(stepId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/sdr/steps/${stepId}/send`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        if (json.code === 'SDR_CREDITS_EXHAUSTED') {
          setPaywallOpen(true)
          return
        }
        toast.error(json.error ?? 'Send failed')
        return
      }
      toast.success('Outreach sent')
      router.refresh()
      await refreshActivity()
      await refreshCredits()
    })
  }

  const kpiItems = [
    { label: 'Leads today', value: stats.leadsFoundToday, icon: Users },
    { label: 'Emails today', value: stats.emailsSentToday, icon: Mail },
    { label: 'Replies this week', value: stats.repliesThisWeek, icon: Zap },
    { label: 'Meetings booked', value: stats.meetingsThisWeek, icon: Calendar },
  ]

  return (
    <div
      className={cn(
        embedded ? 'space-y-6' : 'mx-auto w-full space-y-6 px-4 py-5 md:px-8 md:py-6',
      )}
    >
      {!embedded ? <SdrOutreachHubTabs /> : null}

      <SdrCreditStrip
        credits={credits}
        loading={creditsLoading}
        onUpgradeClick={() => setPaywallOpen(true)}
      />

      <PageHeader
        title={`SDR Agent — ${config.agentName}`}
        description={`${statusLabel} · ${stats.activeSequences} active sequences · ${stats.replyRate30d}% reply rate (30d)`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleRunDiscovery}
            >
              <Radar className="mr-1.5 h-3.5 w-3.5" />
              Run discovery
            </Button>
            <Button variant="outline" size="sm" disabled={isPending} onClick={handlePauseResume}>
              {config.isPaused ? (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/outreach/agents">
                <Bot className="mr-1.5 h-3.5 w-3.5" /> Agent roster
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/outreach/agents/setup">
                <Settings className="mr-1.5 h-3.5 w-3.5" /> Settings
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/outreach/agents/sequences">All sequences</Link>
            </Button>
          </div>
        }
      />

      {!autonomousMessaging && config.isActive && !config.isPaused ? (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-4 py-3 text-[13px] text-[var(--text-primary)]">
          <p className="font-medium">Review mode — outbound is not auto-sent</p>
          <p className="mt-1 text-[var(--text-secondary)]">
            Sequences are drafted for your approval. Enable autonomous messaging in settings to let{' '}
            {config.agentName} send on schedule.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            'inline-flex h-2 w-2 rounded-full',
            config.isActive && !config.isPaused ? 'animate-pulse bg-emerald-500' : 'bg-amber-400',
          )}
        />
        <span className={statusTone}>{statusLabel}</span>
        {config.isPaused && config.pausedReason ? (
          <span className="text-[var(--text-secondary)]">— {config.pausedReason}</span>
        ) : null}
        <span className="text-[var(--text-disabled)]">·</span>
        <Link
          href="/admin/outreach/agents/scout/configure"
          className="status-pill bg-[var(--accent-muted)] text-[var(--text-primary)] hover:opacity-90"
        >
          {config.prospectMode.replace(/_/g, ' ')}
        </Link>
      </div>

      <KpiStrip items={kpiItems} className="lg:grid-cols-4" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <section className="card-surface min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Activity feed</h3>
            <LiveIndicator active={activityLive} />
          </div>
          <SdrActivityFeed events={activity} accountId={config.accountId} />
        </section>

        <aside className="space-y-4">
          <section className="card-surface p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Pipeline added (30d)</h3>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              ${(stats.pipelineAdded30d / 100).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Booking rate {stats.bookingRate30d}% · Reply rate {stats.replyRate30d}%
            </p>
          </section>

          <section className="card-surface p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming sends</h3>
            <ul className="mt-3 space-y-3">
              {upcoming.length === 0 ? (
                <li className="text-sm text-[var(--text-secondary)]">No scheduled sends</li>
              ) : (
                upcoming.map((row) => (
                  <li key={row.step.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-start gap-2">
                      {row.step.channel === 'sms' ? (
                        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                      ) : (
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[var(--text-primary)]">
                          {formatTime(row.step.scheduledFor.toISOString())} · Step {row.step.stepNumber}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Prospect'},{' '}
                          {row.company}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 border-[var(--border-default)] text-[11px]"
                      disabled={isPending}
                      onClick={() => handleSendNow(row.step.id)}
                    >
                      Send now
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card-surface border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Prospect Scout</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/admin/outreach/agents/scout/configure">Configure</Link>
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Mode: <span className="font-medium text-[var(--text-primary)]">{config.prospectMode.replace(/_/g, ' ')}</span>
              {' · '}
              ICP floor {config.defaultMinIcpScore}
            </p>
          </section>

          <section className="card-surface p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Agent stats</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  Found
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {config.stats.totalLeadsFound}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  Contacted
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {config.stats.totalContacted}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  Replied
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {config.stats.totalReplied}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  Booked
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {config.stats.totalBooked}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <SdrCreditPaywall
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        credits={credits}
        onStartTrial={startTrial}
      />
    </div>
  )
}
