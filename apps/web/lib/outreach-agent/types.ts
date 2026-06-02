import type { CampaignWithStats } from '@/lib/outreach/types'

export type OutreachAgentConfig = {
  id: string
  accountId: string
  agentName: string
  linkedCampaignIds: string[]
  isActive: boolean
  isPaused: boolean
  pausedReason: string | null
}

export type OutreachAgentDashboardStats = {
  linkedCampaigns: number
  activeCampaigns: number
  enrolledLeads: number
  sentToday: number
  repliesThisWeek: number
  pendingManualSteps: number
}

export type LinkedCampaignSummary = CampaignWithStats

export type OutreachAgentUpcomingStep = {
  step: {
    id: string
    stepIndex: number
    channel: string
    sendAt: Date
    campaignId: string
  }
  campaignName: string
  firstName: string | null
  lastName: string | null
  company: string
}

export type LaunchOutreachAgentInput = {
  agentName: string
  linkedCampaignIds: string[]
}

export type UpdateOutreachAgentInput = {
  agentName?: string
  linkedCampaignIds?: string[]
}
