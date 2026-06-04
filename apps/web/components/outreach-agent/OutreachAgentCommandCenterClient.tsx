'use client'

import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { OutreachAgentActivityFeed } from '@/components/outreach-agent/OutreachAgentActivityFeed'
import { Button } from '@/components/ui/button'
import { useAccountRealtime } from '@/lib/supabase/account-realtime'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import { Checkbox } from '@/components/ui/checkbox'
import { markCampaignStepSent } from '@/lib/outreach/actions'
import {
  CAMPAIGN_GOAL_LABELS,
  type CampaignWithStats,
} from '@/lib/outreach/types'
import type {
  OutreachAgentConfig,
  OutreachAgentDashboardStats,
  OutreachAgentUpcomingStep,
} from '@/lib/outreach-agent/types'
import { cn } from '@/lib/utils'
import {
  Bot,
  Calendar,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Radar,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  config: OutreachAgentConfig
  stats: OutreachAgentDashboardStats
  linkedCampaigns: CampaignWithStats[]
  allCampaigns: CampaignWithStats[]
  upcoming: OutreachAgentUpcomingStep[]
  manualSteps: OutreachAgentUpcomingStep[]
  initialActivity: SDRActivityEvent[]
}

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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function OutreachAgentCommandCenterClient({
  config,
  stats,
  linkedCampaigns,
  allCampaigns,
  upcoming,
  manualSteps,
  initialActivity,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [manageLinksOpen, setManageLinksOpen] = useState(false)
  const [draftLinkedIds, setDraftLinkedIds] = useState(config.linkedCampaignIds)
  const [activity, setActivity] = useState(initialActivity)

  const refreshActivity = useCallback(async () => {
    const res = await fetch('/api/outreach-agent/activity?limit=50')
    const json = await res.json()
    if (json.success) setActivity(json.data)
  }, [])

  const { isLive: activityLive } = useAccountRealtime({
    accountId: config.accountId,
    table: 'sdr_activity_log',
    onChange: refreshActivity,
  })

  useEffect(() => {
    if (searchParams.get('setup') !== 'complete') return
    toast.message(`${config.agentName} is live — outreach activity appears below`, {
      duration: 5000,
    })
    router.replace('/admin/outreach/agents/outreach')
  }, [config.agentName, router, searchParams])

  const statusLabel = config.isPaused ? 'Paused' : config.isActive ? 'Running' : 'Inactive'
  const statusTone = config.isPaused
    ? 'text-[var(--warning)]'
    : config.isActive
      ? 'text-[var(--success)]'
      : 'text-[var(--text-secondary)]'

  const kpiItems = [
    { label: 'Linked campaigns', value: stats.linkedCampaigns, icon: Link2 },
    { label: 'Active campaigns', value: stats.activeCampaigns, icon: Megaphone },
    { label: 'In sequences', value: stats.enrolledLeads, icon: Users },
    { label: 'Sent today', value: stats.sentToday, icon: Mail },
  ]

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

  function handlePauseResume() {
    startTransition(async () => {
      const res = await fetch('/api/outreach-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: config.isPaused ? 'resume' : 'pause',
          reason: config.isPaused ? undefined : 'Paused from command center',
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Action failed')
        return
      }
      toast.success(config.isPaused ? 'Outreach Agent resumed' : 'Outreach Agent paused')
      router.refresh()
    })
  }

  function handleRunQueue() {
    startTransition(async () => {
      const res = await fetch('/api/outreach-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'run_now' }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Queue run failed')
        return
      }
      const sent = json.data?.sent ?? 0
      const manualReady = json.data?.manualReady ?? 0
      const failed = json.data?.failed ?? 0

      if (failed > 0) {
        toast.error(
          `${failed} step${failed === 1 ? '' : 's'} failed to send — check Settings → Outreach email domain and campaign lead emails`,
        )
      } else if (sent > 0) {
        toast.success(`Processed queue — ${sent} message${sent === 1 ? '' : 's'} sent`)
      } else if (manualReady > 0) {
        toast.success(
          `${manualReady} manual step${manualReady === 1 ? '' : 's'} ready for approval`,
        )
      } else {
        toast.success('Queue checked — nothing due right now')
      }
      router.refresh()
    })
  }

  function handleSaveLinks() {
    startTransition(async () => {
      const res = await fetch('/api/outreach-agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ linkedCampaignIds: draftLinkedIds }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error ?? 'Could not update linked campaigns')
        return
      }
      toast.success('Linked campaigns updated')
      setManageLinksOpen(false)
      router.refresh()
    })
  }

  function handleMarkSent(stepId: string) {
    startTransition(async () => {
      const result = await markCampaignStepSent(stepId)
      if (!result.success) {
        toast.error(result.error ?? 'Could not mark step sent')
        return
      }
      toast.success('Step marked as sent')
      router.refresh()
    })
  }

  return (
    <AdminPageContent>
      <PageHeader
        title={`Outreach Agent — ${config.agentName}`}
        description={`${statusLabel} · ${stats.enrolledLeads} active enrollments · ${stats.repliesThisWeek} replies this week`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleRunQueue}>
              <Radar className="mr-1.5 h-3.5 w-3.5" />
              Run queue
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
          </div>
        }
      />

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
      </div>

      <KpiStrip items={kpiItems} className="lg:grid-cols-4" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <div className="space-y-6">
          <section className="card-surface min-w-0 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Activity feed</h3>
              <LiveIndicator active={activityLive} />
            </div>
            <OutreachAgentActivityFeed events={activity} />
          </section>

          <section className="card-surface p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Linked campaigns</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Outreach Agent orchestrates sends for these campaigns only.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftLinkedIds(config.linkedCampaignIds)
                  setManageLinksOpen((open) => !open)
                }}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                {manageLinksOpen ? 'Cancel' : 'Manage links'}
              </Button>
            </div>

            {manageLinksOpen ? (
              <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
                {allCampaigns.map((campaign) => {
                  const checked = draftLinkedIds.includes(campaign.id)
                  return (
                    <label key={campaign.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-[var(--bg-subtle)]">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setDraftLinkedIds((current) =>
                            current.includes(campaign.id)
                              ? current.filter((id) => id !== campaign.id)
                              : [...current, campaign.id],
                          )
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{campaign.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {CAMPAIGN_GOAL_LABELS[campaign.goal]} · {campaign.status}
                        </p>
                      </div>
                    </label>
                  )
                })}
                <Button size="sm" disabled={isPending || draftLinkedIds.length === 0} onClick={handleSaveLinks}>
                  Save linked campaigns
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedCampaigns.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No linked campaigns yet.</p>
                ) : (
                  linkedCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{campaign.name}</p>
                          <StatusBadge
                            label={campaign.status}
                            tone={campaignStatusTone(campaign.status)}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {CAMPAIGN_GOAL_LABELS[campaign.goal]} · {campaign.metrics.enrolled} enrolled ·{' '}
                          {campaign.metrics.sent} sent · {campaign.metrics.replied} replied
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/outreach/campaigns/${campaign.id}`}>Open campaign</Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <section className="card-surface p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming sends</h3>
            <ul className="mt-3 space-y-3">
              {upcoming.length === 0 ? (
                <li className="text-sm text-[var(--text-secondary)]">No scheduled sends in the next 7 days</li>
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
                          {formatTime(row.step.sendAt)} · Step {row.step.stepIndex + 1} · {row.campaignName}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Prospect'}, {row.company}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card-surface p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Performance (linked)</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--text-secondary)]">Sent</dt>
                <dd className="font-semibold text-[var(--text-primary)]">{aggregateMetrics.sent}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-secondary)]">Replied</dt>
                <dd className="font-semibold text-[var(--text-primary)]">{aggregateMetrics.replied}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-secondary)]">Meetings</dt>
                <dd className="font-semibold text-[var(--text-primary)]">{aggregateMetrics.meetings}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-secondary)]">Replies (7d)</dt>
                <dd className="font-semibold text-[var(--text-primary)]">{stats.repliesThisWeek}</dd>
              </div>
            </dl>
          </section>

          <section className="card-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Manual steps</h3>
              <span className="text-xs text-[var(--text-secondary)]">{stats.pendingManualSteps} pending</span>
            </div>
            <ul className="space-y-3">
              {manualSteps.length === 0 ? (
                <li className="text-sm text-[var(--text-secondary)]">No LinkedIn steps waiting for approval</li>
              ) : (
                manualSteps.map((row) => (
                  <li key={row.step.id} className="rounded-md border border-[var(--border-subtle)] p-3 text-sm">
                    <p className="font-medium text-[var(--text-primary)]">{row.campaignName}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Prospect'}, {row.company}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 h-7 text-[11px]"
                      disabled={isPending}
                      onClick={() => handleMarkSent(row.step.id)}
                    >
                      Mark sent
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card-surface border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-5">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">How linking works</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Campaigns stay in your library. Link any campaign here to surface its queue, metrics, and manual
                  approvals in this command center.
                </p>
              </div>
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 text-[var(--warning)]" />
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Use <span className="font-medium text-[var(--text-primary)]">Run queue</span> to process due email
                and SMS steps immediately. LinkedIn steps always wait for your approval.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </AdminPageContent>
  )
}
