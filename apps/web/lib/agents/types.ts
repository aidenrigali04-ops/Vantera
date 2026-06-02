export type SdrAgentId = 'prospect_scout' | 'outreach_agent' | 'message_drafter' | 'pipeline_analyst'

export type SdrAgentIconName = 'telescope' | 'megaphone' | 'pen-line' | 'brain'

export type SdrAgentStatus = 'active' | 'idle' | 'needs_setup'

export type SdrAgentDefinition = {
  id: SdrAgentId
  name: string
  tagline: string
  description: string
  href: string
  ctaLabel: string
  iconName: SdrAgentIconName
}

export type SdrAgentSnapshot = {
  activeCampaigns: number
  draftCampaigns: number
  activeSavedSearches: number
  pendingDrafts: number
  leadsInPipeline: number
  enrolledLeads: number
  /** SDR config active and not paused — Prospect Scout can run on schedule. */
  prospectScoutActive: boolean
}

export type SdrAgentCard = SdrAgentDefinition & {
  status: SdrAgentStatus
  statLabel: string
  statValue: string
}
