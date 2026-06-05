import { findExtensionLinkedInQueue } from '@/lib/extension/linkedin/queue'
import { findLinkedinAccount } from '@/lib/linkedin/queries'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import type { CampaignWithStats } from '@/lib/outreach/types'
import { getCampaignChannelFocus, getCampaignDeliveryMode } from '@/lib/outreach/types'
import { isLinkedInDeliveryMode } from '@/lib/outreach/campaign-draft-guidelines'
import { getSdrDashboardStats } from '@/lib/sdr/queries'
import { db } from '@/lib/db/client'
import { leads } from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'

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
  source: 'campaign' | 'sdr_sequence'
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

export async function findLinkedInManualQueue(
  accountId: string,
  limit = 12,
): Promise<LinkedInManualQueueItem[]> {
  const snapshot = await findExtensionLinkedInQueue(accountId, { limit })

  return snapshot.items.map((item) => ({
    id: item.id,
    source: item.source,
    leadName: item.leadName,
    campaignName: item.campaignName ?? 'SDR sequence',
    message: item.message,
    linkedinUrl: item.linkedinUrl,
    scheduledAt: item.scheduledAt,
    href:
      item.source === 'campaign' && item.campaignId
        ? `/admin/outreach/campaigns/${item.campaignId}`
        : '/admin/outreach/agents',
  }))
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
      description: 'Install Vantera LinkedIn Outreach from the Chrome Web Store and link it with a connection code.',
      status: connected ? 'complete' : 'current',
    },
    {
      id: 'audience',
      title: 'Enroll leads with LinkedIn URLs',
      description: 'Each prospect needs a LinkedIn profile link on their contact in Vantera.',
      status: hasLinkedInLeads ? 'complete' : connected ? 'current' : 'pending',
    },
    {
      id: 'message',
      title: 'Write connection notes',
      description: 'Write your own note or use an AI draft — then send from the queue after launch.',
      status: hasLaunch ? 'complete' : hasLinkedInLeads ? 'current' : 'pending',
    },
    {
      id: 'launch',
      title: 'Launch & send on LinkedIn',
      description: 'Send each note on LinkedIn, then mark it done in Vantera or the add-on.',
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
