import { PageHeader } from '@/components/operational/PageHeader'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getEmailOutreachHubSnapshot } from '@/lib/outreach/email-hub'
import { getLinkedInOutreachHubSnapshot } from '@/lib/outreach/linkedin-hub'
import { CAMPAIGN_GOAL_LABELS } from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Share2,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function campaignStatusTone(status: string) {
  switch (status) {
    case 'active':
      return 'success' as const
    case 'paused':
      return 'warning' as const
    case 'completed':
      return 'info' as const
    default:
      return 'neutral' as const
  }
}

type ChannelCardProps = {
  icon: typeof Mail
  title: string
  ready: boolean
  statusLabel: string
  detail: string
  href: string
  ctaLabel: string
}

function ChannelCard({ icon: Icon, title, ready, statusLabel, detail, href, ctaLabel }: ChannelCardProps) {
  return (
    <div className="card-surface flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1.5 text-[12px] font-medium',
              ready ? 'text-[var(--success)]' : 'text-[var(--warning)]',
            )}
          >
            {ready ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <CircleAlert className="h-3.5 w-3.5" aria-hidden />
            )}
            {statusLabel}
          </p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[var(--text-tertiary)]">{detail}</p>
      <Link
        href={href}
        className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
      >
        {ctaLabel}
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </div>
  )
}

export default async function OutreachOverviewPage() {
  const session = await requireAdminSession()
  const [email, linkedin] = await Promise.all([
    getEmailOutreachHubSnapshot(session.accountId),
    getLinkedInOutreachHubSnapshot(session.accountId, session.userId),
  ])

  // One campaign list powers both snapshots — aggregate once.
  const campaigns = linkedin.recentCampaigns
  const activeCampaigns = email.campaigns.active
  const totalSent = email.campaigns.sent
  const totalReplied = email.campaigns.replied

  const emailReady = email.setupProgress >= 100 || email.domain.sendingVerified
  const linkedinReady = linkedin.connectionStatus === 'connected'
  const hasCampaigns = campaigns.length > 0
  const nothingReady = !emailReady && !linkedinReady && !hasCampaigns

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outreach"
        description="Campaigns, sequences, and the channels they run on — launch, monitor, and reply from one place."
        actions={
          <Button asChild>
            <Link href="/admin/outreach/campaigns">
              <Plus className="mr-1.5 h-4 w-4" />
              New campaign
            </Link>
          </Button>
        }
      />

      {/* First-run guidance — connect a channel before campaigns make sense. */}
      {nothingReady ? (
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-5 py-4">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            Set up a channel to start reaching out
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Verify your sending domain or connect LinkedIn below — then create your first
            campaign and replies land in your inbox.
          </p>
        </div>
      ) : null}

      <KpiStrip
        items={[
          { label: 'Active campaigns', value: activeCampaigns, icon: Megaphone },
          { label: 'Messages sent', value: totalSent, icon: Send },
          { label: 'Replies', value: totalReplied, icon: MessageSquare },
          {
            label: 'Reply rate (30d)',
            value: `${email.kpis.replyRate30d}%`,
            icon: Mail,
          },
        ]}
      />

      {/* Channel readiness — the prerequisite for everything else. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChannelCard
          icon={Mail}
          title="Email"
          ready={emailReady}
          statusLabel={emailReady ? 'Ready to send' : 'Setup incomplete'}
          detail={
            emailReady
              ? `Sending as ${email.domain.previewFrom} · ${email.kpis.emailsSentToday} sent today, ${email.kpis.dueNow} due now.`
              : 'Verify your sending domain so campaigns and sequences can deliver email.'
          }
          href="/admin/outreach/email"
          ctaLabel={emailReady ? 'Open email hub' : 'Finish email setup'}
        />
        <ChannelCard
          icon={Share2}
          title="LinkedIn"
          ready={linkedinReady}
          statusLabel={
            linkedinReady
              ? 'Connected'
              : linkedin.connectionStatus === 'pacing'
                ? 'Connected — pacing'
                : 'Not connected'
          }
          detail={
            linkedinReady
              ? `${linkedin.kpis.manualQueue} in send queue · ${linkedin.kpis.enrolledThisWeek} leads enrolled this week.`
              : 'Connect your LinkedIn account to run connection requests and messages.'
          }
          href="/admin/outreach/linkedin"
          ctaLabel={linkedinReady ? 'Open LinkedIn hub' : 'Connect LinkedIn'}
        />
      </div>

      {/* Recent campaigns — the core loop surface. */}
      <section className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent campaigns</h3>
          <Link
            href="/admin/outreach/campaigns"
            className="text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            View all
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Megaphone className="mx-auto h-7 w-7 text-[var(--text-disabled)]" aria-hidden />
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">No campaigns yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--text-tertiary)]">
              Pick a goal, choose leads from your pipeline, and launch — results show up here.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/admin/outreach/campaigns">Create your first campaign</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {campaigns.slice(0, 5).map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/admin/outreach/campaigns/${campaign.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--bg-overlay)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                      {CAMPAIGN_GOAL_LABELS[campaign.goal as keyof typeof CAMPAIGN_GOAL_LABELS] ??
                        campaign.goal}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-6 text-[12px] tabular-nums text-[var(--text-secondary)] sm:flex">
                    <span title="Enrolled">{campaign.enrolled} enrolled</span>
                    <span title="Sent">{campaign.sent} sent</span>
                    <span title="Replied">{campaign.replied} replied</span>
                  </div>
                  <StatusBadge label={campaign.status} tone={campaignStatusTone(campaign.status)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
