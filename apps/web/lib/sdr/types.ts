import type { ICPConfig } from '@/lib/aspire/types'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation'

export type SdrOutreachWindow = {
  startHour: number
  endHour: number
  tz: string
}

export interface SDRAgentConfig {
  id: string
  accountId: string
  agentName: string
  agentTitle: string
  fromEmail: string
  fromName: string
  signature: string | null
  icpConfig: ICPConfig
  targetVerticals: string[]
  targetCities: string[]
  excludeDomains: string[]
  searchFrequency: 'daily' | 'weekly'
  outreachDays: string[]
  outreachWindow: SdrOutreachWindow
  maxNewLeadsDay: number
  maxActiveLeads: number
  prospectMode: ProspectMode
  defaultMinIcpScore: number
  syncIcpToSavedSearches: boolean
  outreachAutomationMode: OutreachAutomationMode
  isActive: boolean
  isPaused: boolean
  pausedReason: string | null
  stats: {
    totalLeadsFound: number
    totalContacted: number
    totalReplied: number
    totalBooked: number
    replyRate: number
    bookingRate: number
  }
}

export type ProspectMode = 'aspire_bound' | 'inline_icp' | 'hybrid'

export type CreateSDRConfigInput = {
  agentName: string
  agentTitle?: string
  fromEmail?: string
  fromName?: string
  signature?: string | null
  icpConfig: ICPConfig
  targetVerticals?: string[]
  targetCities?: string[]
  excludeDomains?: string[]
  searchFrequency?: 'daily' | 'weekly'
  outreachDays?: string[]
  outreachWindow?: SdrOutreachWindow
  maxNewLeadsDay?: number
  maxActiveLeads?: number
  isActive?: boolean
  prospectMode?: ProspectMode
  defaultMinIcpScore?: number
  syncIcpToSavedSearches?: boolean
  outreachAutomationMode?: OutreachAutomationMode
}

export interface SDRSequenceStep {
  stepNumber: number
  channel: 'email' | 'sms' | 'linkedin'
  subject: string | null
  body: string
  dayOffset: number
}

export interface SDRDraftPayload {
  accountId: string
  agentName: string
  accountDisplayName: string
  vertical: string
  firstName: string
  lastName: string
  title: string
  company: string
  employeeCount: number | null
  icpScore: number
  icpSignals: string[]
  memoryContext: string
}

export interface SDRActivityEvent {
  id: string
  eventType: string
  leadId: string | null
  sequenceId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  leadName?: string
  company?: string
}

export interface SDRDashboardStats {
  activeSequences: number
  leadsFoundToday: number
  emailsSentToday: number
  smsSentToday: number
  repliesThisWeek: number
  meetingsThisWeek: number
  replyRate30d: number
  bookingRate30d: number
  pipelineAdded30d: number
  topPerformingStep: number | null
}

export type SdrSequenceStatus =
  | 'active'
  | 'replied'
  | 'booked'
  | 'completed'
  | 'unsubscribed'
  | 'paused'
  | 'cancelled'

export type SdrReplyType = 'interested' | 'objection' | 'wrong_person' | 'unsubscribe'

export type DraftSdrSequencePayload = {
  accountId: string
  configId: string
  sequenceId: string
  leadId: string
  aspireResultId?: string | null
}

export const SDR_DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export const DEFAULT_OUTREACH_WINDOW: SdrOutreachWindow = {
  startHour: 8,
  endHour: 17,
  tz: 'America/New_York',
}
