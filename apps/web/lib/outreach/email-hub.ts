import { db } from '@/lib/db/client'
import { getAccountEmailDomainConfig } from '@/lib/outreach/email-domain'
import { filterEmailCampaigns } from '@/lib/outreach/linkedin-hub'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import type { CampaignWithStats } from '@/lib/outreach/types'
import {
  loadResendDomainWithRecords,
  mapResendStatus,
  parseStoredDomainDns,
} from '@/lib/outreach/resend-domains'
import type { OutreachDomainSettings } from '@/lib/settings/outreach-domain-actions'
import { getSdrDashboardStats, findSdrConfigByAccount } from '@/lib/sdr/queries'
import { normalizeOutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import {
  accounts,
  leads,
  outreachCampaignSteps,
  outreachCampaigns,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'

export type EmailSetupStepId = 'domain' | 'sending' | 'replies' | 'launch'

export type EmailSetupStepStatus = 'complete' | 'current' | 'pending' | 'failed'

export type EmailSetupStep = {
  id: EmailSetupStepId
  title: string
  description: string
  status: EmailSetupStepStatus
}

export type EmailDueQueueItem = {
  id: string
  source: 'campaign' | 'sdr'
  leadName: string
  label: string
  subject: string | null
  scheduledAt: string
  href: string
}

export type EmailOutreachHubSnapshot = {
  updatedAt: string
  domain: {
    fromDomain: string | null
    inboundDomain: string | null
    fromLocalPart: string
    domainStatus: string
    inboundDomainStatus: string
    previewFrom: string
    previewReplyDomain: string
    isCustomDomain: boolean
    sendingVerified: boolean
    inboundVerified: boolean
  }
  setupSteps: EmailSetupStep[]
  setupProgress: number
  kpis: {
    emailsSentToday: number
    activeCampaigns: number
    dueNow: number
    repliesThisWeek: number
    replyRate30d: number
  }
  campaigns: {
    total: number
    active: number
    sent: number
    replied: number
  }
  sdr: {
    configured: boolean
    automationMode: 'review' | 'automatic'
    activeSequences: number
    dueEmailSteps: number
  }
  dueQueue: EmailDueQueueItem[]
  recentCampaigns: Array<{
    id: string
    name: string
    status: string
    goal: string
    sent: number
    replied: number
    enrolled: number
  }>
}

async function fetchInboundDomainStatus(resendInboundDomainId: string | null): Promise<string> {
  if (!resendInboundDomainId) return 'not_configured'
  try {
    const inbound = await loadResendDomainWithRecords(resendInboundDomainId)
    return mapResendStatus(inbound.status)
  } catch {
    return 'pending'
  }
}

async function loadAccountDomainRow(accountId: string) {
  const [account] = await db
    .select({
      name: accounts.name,
      outreachFromDomain: accounts.outreachFromDomain,
      outreachInboundDomain: accounts.outreachInboundDomain,
      outreachFromLocalPart: accounts.outreachFromLocalPart,
      outreachDomainStatus: accounts.outreachDomainStatus,
      outreachDomainDns: accounts.outreachDomainDns,
      resendOutreachDomainId: accounts.resendOutreachDomainId,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return account ?? null
}

function buildDomainSummary(
  account: NonNullable<Awaited<ReturnType<typeof loadAccountDomainRow>>>,
  config: NonNullable<Awaited<ReturnType<typeof getAccountEmailDomainConfig>>>,
  inboundDomainStatus: string,
): EmailOutreachHubSnapshot['domain'] {
  const hasConfiguredDomain = Boolean(account.outreachFromDomain)
  const domainStatus = account.outreachDomainStatus ?? 'not_configured'

  return {
    fromDomain: account.outreachFromDomain ?? null,
    inboundDomain: account.outreachInboundDomain ?? null,
    fromLocalPart: account.outreachFromLocalPart ?? 'outreach',
    domainStatus,
    inboundDomainStatus,
    previewFrom: hasConfiguredDomain
      ? `${account.outreachFromLocalPart ?? 'outreach'}@${account.outreachFromDomain}`
      : config.fromAddress,
    previewReplyDomain: hasConfiguredDomain
      ? (account.outreachInboundDomain ?? `inbound.${account.outreachFromDomain}`)
      : config.replyDomain,
    isCustomDomain: hasConfiguredDomain,
    sendingVerified: domainStatus === 'verified',
    inboundVerified: inboundDomainStatus === 'verified',
  }
}

function buildSetupSteps(
  domain: EmailOutreachHubSnapshot['domain'],
  hasLaunchActivity: boolean,
): EmailSetupStep[] {
  const hasDomain = Boolean(domain.fromDomain)
  const sendingOk = domain.sendingVerified
  const inboundOk = domain.inboundVerified
  const sendingFailed = domain.domainStatus === 'failed'

  const domainStatus: EmailSetupStepStatus = hasDomain ? 'complete' : 'current'
  const sendingStatus: EmailSetupStepStatus = sendingFailed
    ? 'failed'
    : sendingOk
      ? 'complete'
      : hasDomain
        ? 'current'
        : 'pending'
  const repliesStatus: EmailSetupStepStatus = inboundOk
    ? 'complete'
    : sendingOk
      ? 'current'
      : 'pending'
  const launchStatus: EmailSetupStepStatus = hasLaunchActivity
    ? 'complete'
    : sendingOk
      ? 'current'
      : 'pending'

  return [
    {
      id: 'domain',
      title: 'Add your domain',
      description: 'Use the same domain as your work email (e.g. yourcompany.com).',
      status: domainStatus,
    },
    {
      id: 'sending',
      title: 'Verify sending DNS',
      description: 'SPF, DKIM, and MX on the send subdomain so outreach can deliver.',
      status: sendingStatus,
    },
    {
      id: 'replies',
      title: 'Enable reply tracking',
      description: 'Inbound MX records route replies back into your pipeline.',
      status: repliesStatus,
    },
    {
      id: 'launch',
      title: 'Launch email outreach',
      description: 'Start a campaign or enroll leads in SDR sequences.',
      status: launchStatus,
    },
  ]
}

function leadDisplayName(lead: {
  firstName: string | null
  lastName: string | null
  company: string | null
  email: string | null
}): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || lead.email || 'Unknown lead'
}

export async function findDueEmailOutreachQueue(
  accountId: string,
  limit = 12,
): Promise<EmailDueQueueItem[]> {
  const now = new Date()

  const [campaignRows, sdrRows] = await Promise.all([
    db
      .select({
        step: outreachCampaignSteps,
        lead: leads,
        campaign: outreachCampaigns,
      })
      .from(outreachCampaignSteps)
      .innerJoin(leads, eq(leads.id, outreachCampaignSteps.leadId))
      .innerJoin(outreachCampaigns, eq(outreachCampaigns.id, outreachCampaignSteps.campaignId))
      .where(
        and(
          eq(outreachCampaignSteps.accountId, accountId),
          eq(outreachCampaignSteps.status, 'pending'),
          eq(outreachCampaignSteps.channel, 'email'),
          lte(outreachCampaignSteps.sendAt, now),
          isNull(leads.deletedAt),
          isNull(outreachCampaigns.deletedAt),
        ),
      )
      .orderBy(asc(outreachCampaignSteps.sendAt))
      .limit(limit),
    db
      .select({
        step: sdrSequenceSteps,
        lead: leads,
        sequence: sdrSequences,
      })
      .from(sdrSequenceSteps)
      .innerJoin(leads, eq(leads.id, sdrSequenceSteps.leadId))
      .innerJoin(sdrSequences, eq(sdrSequences.id, sdrSequenceSteps.sequenceId))
      .where(
        and(
          eq(sdrSequenceSteps.accountId, accountId),
          eq(sdrSequenceSteps.status, 'scheduled'),
          eq(sdrSequenceSteps.channel, 'email'),
          lte(sdrSequenceSteps.scheduledFor, now),
          isNull(sdrSequenceSteps.deletedAt),
          isNull(sdrSequences.deletedAt),
        ),
      )
      .orderBy(asc(sdrSequenceSteps.scheduledFor))
      .limit(limit),
  ])

  const merged: Array<EmailDueQueueItem & { sortAt: number }> = [
    ...campaignRows.map((row) => ({
      id: row.step.id,
      source: 'campaign' as const,
      leadName: leadDisplayName(row.lead),
      label: row.campaign.name,
      subject: row.step.subject,
      scheduledAt: row.step.sendAt.toISOString(),
      href: `/admin/outreach/campaigns/${row.campaign.id}`,
      sortAt: row.step.sendAt.getTime(),
    })),
    ...sdrRows.map((row) => ({
      id: row.step.id,
      source: 'sdr' as const,
      leadName: leadDisplayName(row.lead),
      label: 'SDR sequence',
      subject: row.step.subject,
      scheduledAt: row.step.scheduledFor.toISOString(),
      href: `/admin/outreach/agents/drafter`,
      sortAt: row.step.scheduledFor.getTime(),
    })),
  ]

  return merged
    .sort((a, b) => a.sortAt - b.sortAt)
    .slice(0, limit)
    .map(({ sortAt: _sortAt, ...item }) => item)
}

export async function getEmailOutreachHubSnapshot(
  accountId: string,
): Promise<EmailOutreachHubSnapshot> {
  const [account, config, sdrConfig, sdrStats, campaigns, dueQueue] = await Promise.all([
    loadAccountDomainRow(accountId),
    getAccountEmailDomainConfig(accountId),
    findSdrConfigByAccount(accountId),
    getSdrDashboardStats(accountId),
    findOutreachCampaigns(accountId),
    findDueEmailOutreachQueue(accountId, 12),
  ])

  if (!account || !config) {
    throw new Error('Account not found')
  }

  const parsed = parseStoredDomainDns(account.outreachDomainDns)
  const inboundDomainStatus = await fetchInboundDomainStatus(parsed.resendInboundDomainId)
  const domain = buildDomainSummary(account, config, inboundDomainStatus)

  const emailCampaigns = filterEmailCampaigns(campaigns)
  const activeCampaigns = emailCampaigns.filter((c) => c.status === 'active')
  const campaignSent = emailCampaigns.reduce((sum, c) => sum + c.metrics.sent, 0)
  const campaignReplied = emailCampaigns.reduce((sum, c) => sum + c.metrics.replied, 0)

  const [dueSdrEmailCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.accountId, accountId),
        eq(sdrSequenceSteps.status, 'scheduled'),
        eq(sdrSequenceSteps.channel, 'email'),
        lte(sdrSequenceSteps.scheduledFor, new Date()),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )

  const hasLaunchActivity =
    activeCampaigns.length > 0 || (sdrStats.activeSequences ?? 0) > 0

  const setupSteps = buildSetupSteps(domain, hasLaunchActivity)
  const completedSteps = setupSteps.filter((s) => s.status === 'complete').length
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100)

  return {
    updatedAt: new Date().toISOString(),
    domain,
    setupSteps,
    setupProgress,
    kpis: {
      emailsSentToday: sdrStats.emailsSentToday,
      activeCampaigns: activeCampaigns.length,
      dueNow: dueQueue.length,
      repliesThisWeek: sdrStats.repliesThisWeek,
      replyRate30d: sdrStats.replyRate30d,
    },
    campaigns: {
      total: emailCampaigns.length,
      active: activeCampaigns.length,
      sent: campaignSent,
      replied: campaignReplied,
    },
    sdr: {
      configured: Boolean(sdrConfig),
      automationMode: normalizeOutreachAutomationMode(sdrConfig?.outreachAutomationMode),
      activeSequences: sdrStats.activeSequences,
      dueEmailSteps: dueSdrEmailCount?.count ?? 0,
    },
    dueQueue,
    recentCampaigns: emailCampaigns.slice(0, 5).map((c: CampaignWithStats) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      goal: c.goal,
      sent: c.metrics.sent,
      replied: c.metrics.replied,
      enrolled: c.metrics.enrolled,
    })),
  }
}

/** Settings payload for embedded domain panel on the email page. */
export async function getEmailPageDomainSettings(): Promise<OutreachDomainSettings | null> {
  const { getOutreachDomainSettings } = await import('@/lib/settings/outreach-domain-actions')
  const result = await getOutreachDomainSettings()
  return result.success && result.data ? result.data : null
}
