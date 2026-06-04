'use client'

import { EmailSetupPipeline } from '@/components/outreach/EmailSetupPipeline'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { OutreachDomainSettingsPanel } from '@/components/settings/OutreachDomainSettings'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import type { OutreachDomainSettings } from '@/lib/settings/outreach-domain-actions'
import type { EmailOutreachHubSnapshot } from '@/lib/outreach/email-hub'
import { CAMPAIGN_GOAL_LABELS } from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  Bot,
  Clock,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  initialHub: EmailOutreachHubSnapshot
  domainSettings: OutreachDomainSettings
}

async function fetchEmailHub(): Promise<EmailOutreachHubSnapshot> {
  const res = await fetch('/api/outreach/email-hub', { cache: 'no-store' })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error ?? 'Could not refresh email hub')
  }
  return json.data as EmailOutreachHubSnapshot
}

export function EmailOutreachPageClient({ initialHub, domainSettings }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: hub = initialHub, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['email-outreach-hub'],
    queryFn: fetchEmailHub,
    initialData: initialHub,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const setupComplete = hub.setupProgress >= 100
  const showDomainPanel = !hub.domain.sendingVerified || !hub.domain.inboundVerified

  function handleDomainSaved() {
    void queryClient.invalidateQueries({ queryKey: ['email-outreach-hub'] })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email outreach"
        description="Connect your domain, verify DNS, and run campaigns and SDR sequences from one command center."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[var(--border-default)]"
              disabled={isFetching}
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['email-outreach-hub'] })}
            >
              <RefreshCw className={cn('mr-1.5 h-4 w-4', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" asChild className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]">
              <Link href="/admin/outreach/campaigns?channel=email">
                <Plus className="mr-1.5 h-4 w-4" />
                New email campaign
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset',
            hub.domain.sendingVerified
              ? 'bg-[var(--success-muted)] text-[var(--success)] ring-transparent'
              : 'bg-[var(--warning-muted)] text-[var(--warning)] ring-transparent',
          )}
        >
          <Mail className="h-3 w-3" aria-hidden />
          Send: {hub.domain.sendingVerified ? 'Verified' : hub.domain.domainStatus}
        </span>
        {hub.domain.fromDomain ? (
          <span className="font-mono text-[var(--text-secondary)]">{hub.domain.previewFrom}</span>
        ) : (
          <span>Platform default sender until domain is configured</span>
        )}
        {dataUpdatedAt ? (
          <span className="ml-auto tabular-nums">
            Updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
          </span>
        ) : null}
      </div>

      <section className="card-surface border-[var(--border-subtle)] p-4">
        <p className="text-[13px] text-[var(--text-secondary)]">
          LinkedIn outreach is separate —{' '}
          <Link href="/admin/outreach/linkedin" className="font-medium text-[var(--accent)] hover:underline">
            open LinkedIn hub
          </Link>{' '}
          for connection notes and the manual send queue.
        </p>
      </section>

      <EmailSetupPipeline steps={hub.setupSteps} progress={hub.setupProgress} />

      <KpiStrip
        items={[
          {
            label: 'Emails sent today',
            value: hub.kpis.emailsSentToday,
            icon: Send,
          },
          {
            label: 'Active campaigns',
            value: hub.kpis.activeCampaigns,
            icon: Megaphone,
          },
          {
            label: 'Due now',
            value: hub.kpis.dueNow,
            change: hub.kpis.dueNow > 0 ? 'In send window' : 'Queue clear',
            icon: Clock,
          },
          {
            label: 'Replies (7d)',
            value: hub.kpis.repliesThisWeek,
            icon: Mail,
          },
          {
            label: 'Reply rate (30d)',
            value: `${hub.kpis.replyRate30d}%`,
            icon: Sparkles,
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <section className="card-surface overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Send queue
                </h2>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  Email steps ready to send — campaigns and SDR sequences.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/outreach/agents/drafter">Open drafter</Link>
              </Button>
            </div>

            {hub.dueQueue.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Clock className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" aria-hidden />
                <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">Queue is clear</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--text-secondary)]">
                  {setupComplete
                    ? 'Enroll leads in a campaign or SDR sequence to populate the pipeline.'
                    : 'Finish domain setup below, then launch your first campaign.'}
                </p>
                {!setupComplete ? (
                  <Button className="mt-4" variant="outline" size="sm" asChild>
                    <a href="#email-domain-setup">Set up domain</a>
                  </Button>
                ) : (
                  <Button className="mt-4" size="sm" asChild>
                    <Link href="/admin/outreach/campaigns?channel=email">Create campaign</Link>
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {hub.dueQueue.map((item) => (
                  <li key={`${item.source}-${item.id}`}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-4 px-5 py-3 transition-colors duration-120 ease hover:bg-[var(--bg-overlay)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
                        <Send className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {item.leadName}
                        </p>
                        <p className="truncate text-[12px] text-[var(--text-secondary)]">
                          {item.label}
                          {item.subject ? ` · ${item.subject}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge
                          tone={item.source === 'campaign' ? 'info' : 'neutral'}
                          label={item.source === 'campaign' ? 'Campaign' : 'SDR'}
                        />
                        <p className="mt-1 text-[11px] tabular-nums text-[var(--text-tertiary)]">
                          {formatDistanceToNow(new Date(item.scheduledAt), { addSuffix: true })}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-surface overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Campaigns
                </h2>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  {hub.campaigns.sent} sent · {hub.campaigns.replied} replied across{' '}
                  {hub.campaigns.total} total
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/outreach/campaigns?channel=email">View all</Link>
              </Button>
            </div>

            {hub.recentCampaigns.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-[var(--text-secondary)]">
                No campaigns yet.{' '}
                <Link href="/admin/outreach/campaigns?channel=email" className="font-medium text-[var(--accent)]">
                  Create your first campaign
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {hub.recentCampaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      href={`/admin/outreach/campaigns/${campaign.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-[var(--bg-overlay)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {campaign.name}
                        </p>
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {CAMPAIGN_GOAL_LABELS[campaign.goal as keyof typeof CAMPAIGN_GOAL_LABELS] ??
                            campaign.goal}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge
                          tone={
                            campaign.status === 'active'
                              ? 'success'
                              : campaign.status === 'paused'
                                ? 'warning'
                                : 'neutral'
                          }
                          label={campaign.status}
                        />
                        <span className="text-[12px] tabular-nums text-[var(--text-secondary)]">
                          {campaign.sent} sent
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <section className="card-surface p-5">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Outreach workflows
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Pick a path after your domain is verified.
            </p>
            <ul className="mt-4 space-y-3">
              <WorkflowCard
                href="/admin/outreach/campaigns?channel=email"
                title="Campaigns"
                description="Goal-based bulk email with enrollments, drafts, and metrics."
                disabled={!hub.domain.sendingVerified}
                disabledHint="Verify sending DNS first"
              />
              <WorkflowCard
                href="/admin/outreach/agents"
                title="SDR agents"
                description={`Scout → drafter → send. Mode: ${hub.sdr.automationMode === 'automatic' ? 'Automatic' : 'Review before send'}.`}
                badge={
                  hub.sdr.configured
                    ? `${hub.sdr.activeSequences} active`
                    : 'Not configured'
                }
              />
              <WorkflowCard
                href="/admin/outreach/agents/scout"
                title="Prospect Scout"
                description="Discover ICP leads and enroll into email sequences."
              />
              <WorkflowCard
                href="/admin/outreach/aspire"
                title="Aspire search"
                description="Import prospects and push to pipeline with enrichment."
              />
            </ul>
          </section>

          {showDomainPanel ? (
            <div id="email-domain-setup">
              <OutreachDomainSettingsPanel
                initial={domainSettings}
                embedded
                onSaved={handleDomainSaved}
              />
            </div>
          ) : (
            <section className="card-surface border-[var(--success)]/20 bg-[var(--success-muted)]/30 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-muted)] text-[var(--success)]">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Email channel ready</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    Sending from {hub.domain.previewFrom}. Replies route to{' '}
                    <span className="font-mono text-[12px]">{hub.domain.previewReplyDomain}</span>.
                  </p>
                  <Button variant="link" className="mt-2 h-auto p-0 text-[var(--accent)]" asChild>
                    <Link href="/admin/settings">Change domain in settings</Link>
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

type WorkflowCardProps = {
  href: string
  title: string
  description: string
  badge?: string
  disabled?: boolean
  disabledHint?: string
}

function WorkflowCard({
  href,
  title,
  description,
  badge,
  disabled,
  disabledHint,
}: WorkflowCardProps) {
  const content = (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] p-4 transition-colors duration-120 ease',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-[var(--border-default)] hover:bg-[var(--bg-overlay)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{title}</p>
        {badge ? (
          <span className="shrink-0 rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
      {disabled && disabledHint ? (
        <p className="mt-2 text-[11px] font-medium text-[var(--warning)]">{disabledHint}</p>
      ) : null}
    </div>
  )

  if (disabled) return content

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]">
      {content}
    </Link>
  )
}
