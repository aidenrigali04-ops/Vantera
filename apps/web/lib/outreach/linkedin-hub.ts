import { db } from '@/lib/db/client'
import { findLinkedinAccount } from '@/lib/linkedin/queries'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import type { CampaignWithStats } from '@/lib/outreach/types'
import { getCampaignChannelFocus, getCampaignDeliveryMode } from '@/lib/outreach/types'
import { isLinkedInDeliveryMode } from '@/lib/outreach/campaign-draft-guidelines'
import { getSdrDashboardStats } from '@/lib/sdr/queries'
import { leads, outreachCampaignSteps } from '@vantera/db'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'

export type LinkedInSetupStepId = 'connect' | 'audience' | 'message' | 'launch'

export type LinkedInSetupStepStatus = 'complete' | 'current' | 'pending' | 'failed'

export type LinkedInSetupStep = {
  id: LinkedInSetupStepId
  title: string
  description: string
  status: LinkedInSetupStepStatus
}

export type LinkedInManualQueueItem = {
  id: string
  leadName: string
  campaignName: string
  message: string
  linkedinUrl: string | null
  scheduledAt: string
  href: string
}

export type LinkedInOutreachHubSnapshot = {
  updatedAt: string
  connectionStatus: 'connected' | 'disconnected' | 'pacing'
  setupSteps: LinkedInSetupStep[]
  setupProgress: number
  kpis: {
    activeCampaigns: number
    manualQueue: number
    leadsWithLinkedIn: number
    enrolledThisWeek: number
  }
  campaigns: {
    total: number
    active: number
    sent: number
    replied: number
  }
  manualQueue: LinkedInManualQueueItem[]
  recentCampaigns: Array<{
    id: string
    name: string
    status: string
    goal: string
    deliveryMode: string
    sent: number
    replied: number
    enrolled: number
  }>
}

export function filterLinkedInCampaigns(campaigns: CampaignWithStats[]): CampaignWithStats[] {
  return campaigns.filter((c) => getCampaignChannelFocus(c.workflow) === 'linkedin')
}

export function filterEmailCampaigns(campaigns: CampaignWithStats[]): CampaignWithStats[] {
  return campaigns.filter((c) => getCampaignChannelFocus(c.workflow) === 'email')
}

function leadDisplayName(lead: {
  firstName: string | null
  lastName: string | null
  company: string | null
}): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Unknown lead'
}

export async function findLinkedInManualQueue(
  accountId: string,
  limit = 12,
): Promise<LinkedInManualQueueItem[]> {
  const now = new Date()

  const rows = await db
    .select({
      step: outreachCampaignSteps,
      lead: leads,
    })
    .from(outreachCampaignSteps)
    .innerJoin(leads, eq(leads.id, outreachCampaignSteps.leadId))
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        eq(outreachCampaignSteps.status, 'pending'),
        eq(outreachCampaignSteps.channel, 'linkedin'),
        lte(outreachCampaignSteps.sendAt, now),
        isNull(leads.deletedAt),
        sql`COALESCE(${outreachCampaignSteps.metadata}->>'manualSend', 'false') = 'true'`,
      ),
    )
    .orderBy(asc(outreachCampaignSteps.sendAt))
    .limit(limit)

  const campaignNames = new Map<string, string>()
  const allCampaigns = await findOutreachCampaigns(accountId)
  for (const c of filterLinkedInCampaigns(allCampaigns)) {
    campaignNames.set(c.id, c.name)
  }

  return rows.map((row) => {
    const metadata = row.step.metadata as { message?: string } | null
    return {
      id: row.step.id,
      leadName: leadDisplayName(row.lead),
      campaignName: campaignNames.get(row.step.campaignId) ?? 'Campaign',
      message: metadata?.message ?? row.step.body,
      linkedinUrl: row.lead.linkedinUrl,
      scheduledAt: row.step.sendAt.toISOString(),
      href: `/admin/outreach/campaigns/${row.step.campaignId}`,
    }
  })
}

function buildSetupSteps(
  connected: boolean,
  hasLaunch: boolean,
  hasLinkedInLeads: boolean,
): LinkedInSetupStep[] {
  return [
    {
      id: 'connect',
      title: 'Connect LinkedIn',
      description: 'Install the browser extension so Vantera can pace outreach safely.',
      status: connected ? 'complete' : 'current',
    },
    {
      id: 'audience',
      title: 'Enroll leads with LinkedIn URLs',
      description: 'Prospects need a LinkedIn profile link on their contact record.',
      status: hasLinkedInLeads ? 'complete' : connected ? 'current' : 'pending',
    },
    {
      id: 'message',
      title: 'Write connection notes',
      description: 'Custom copy or AI draft — manual send from the queue after launch.',
      status: hasLaunch ? 'complete' : hasLinkedInLeads ? 'current' : 'pending',
    },
    {
      id: 'launch',
      title: 'Launch & send on LinkedIn',
      description: 'Copy messages from the queue, connect in LinkedIn, mark sent in Vantera.',
      status: hasLaunch ? 'current' : 'pending',
    },
  ]
}

export async function getLinkedInOutreachHubSnapshot(
  accountId: string,
  userId: string,
): Promise<LinkedInOutreachHubSnapshot> {
  const [allCampaigns, account, manualQueue, leadsWithLi] = await Promise.all([
    findOutreachCampaigns(accountId),
    findLinkedinAccount(accountId, userId),
    findLinkedInManualQueue(accountId, 12),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.accountId, accountId),
          isNull(leads.deletedAt),
          sql`${leads.linkedinUrl} IS NOT NULL AND trim(${leads.linkedinUrl}) <> ''`,
        ),
      ),
  ])

  const campaigns = filterLinkedInCampaigns(allCampaigns)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active')
  const sent = campaigns.reduce((sum, c) => sum + c.metrics.sent, 0)
  const replied = campaigns.reduce((sum, c) => sum + c.metrics.replied, 0)
  const hasLaunch = activeCampaigns.length > 0

  const connectionStatus = account?.extensionConnected ? 'connected' : 'disconnected'
  const setupSteps = buildSetupSteps(
    connectionStatus === 'connected',
    hasLaunch,
    (leadsWithLi[0]?.count ?? 0) > 0,
  )
  const completedSteps = setupSteps.filter((s) => s.status === 'complete').length
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100)

  let enrolledThisWeek = 0
  try {
    const stats = await getSdrDashboardStats(accountId)
    enrolledThisWeek = stats.leadsFoundToday
  } catch {
    enrolledThisWeek = 0
  }

  return {
    updatedAt: new Date().toISOString(),
    connectionStatus,
    setupSteps,
    setupProgress,
    kpis: {
      activeCampaigns: activeCampaigns.length,
      manualQueue: manualQueue.length,
      leadsWithLinkedIn: leadsWithLi[0]?.count ?? 0,
      enrolledThisWeek,
    },
    campaigns: {
      total: campaigns.length,
      active: activeCampaigns.length,
      sent,
      replied,
    },
    manualQueue,
    recentCampaigns: campaigns.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      goal: c.goal,
      deliveryMode: getCampaignDeliveryMode(c.workflow),
      sent: c.metrics.sent,
      replied: c.metrics.replied,
      enrolled: c.metrics.enrolled,
    })),
  }
}

export function isLinkedInCampaign(campaign: CampaignWithStats): boolean {
  return getCampaignChannelFocus(campaign.workflow) === 'linkedin'
}

export { isLinkedInDeliveryMode }
