export type SdrAgentId = 'prospect_scout' | 'outreach_agent' | 'message_drafter' | 'pipeline_analyst'

export type SdrAgentIconName = 'telescope' | 'megaphone' | 'pen-line' | 'brain'

export type SdrAgentStatus = 'active' | 'inactive' | 'idle' | 'needs_setup'

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
  pendingEmailDrafts: number
  pendingLinkedInDrafts: number
  leadsInPipeline: number
  enrolledLeads: number
  /** SDR config exists (setup complete). */
  prospectScoutConfigured: boolean
  /** SDR config active and not paused — Prospect Scout can run on schedule. */
  prospectScoutActive: boolean
  /** Outreach Agent config exists with at least one linked campaign. */
  outreachAgentConfigured: boolean
  /** Outreach Agent active and not paused. */
  outreachAgentActive: boolean
  /** Linked campaigns currently active. */
  linkedActiveCampaigns: number
  /** Workspace automatic outreach toggle. */
  automaticOutreach: boolean
  /** Active auto-generated Scout run campaigns. */
  autoScoutActiveCampaigns: number
}

export type SdrAgentCard = SdrAgentDefinition & {
  status: SdrAgentStatus
  statLabel: string
  statValue: string
}
