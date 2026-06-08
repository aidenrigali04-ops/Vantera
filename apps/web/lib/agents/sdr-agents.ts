import type { SdrAgentCard, SdrAgentDefinition, SdrAgentSnapshot } from '@/lib/agents/types'

export const SDR_AGENTS_HEADLINE = 'Build your SDR Agents'
export const SDR_AGENTS_SUBHEADLINE =
  'Deploy AI agents that find, contact, and nurture leads around the clock — without adding headcount. Your pipeline never sleeps.'

export const SDR_AGENT_DEFINITIONS: SdrAgentDefinition[] = [
  {
    id: 'prospect_scout',
    name: 'Prospect Scout',
    tagline: 'Finds ICP-matched leads while you sleep',
    description:
      'Runs on your schedule from agent ICP rules, discovers prospects via Apify, scores them, and adds qualified matches to your pipeline automatically.',
    href: '/admin/outreach/agents/setup',
    ctaLabel: 'Set up Prospect Scout',
    iconName: 'telescope',
  },
  {
    id: 'outreach_agent',
    name: 'Outreach Agent',
    tagline: 'Runs email, LinkedIn, and SMS sequences',
    description:
      'In Automatic mode, creates and launches a campaign per Scout run with personalized copy. In Manual mode, links your campaigns and runs the queue on schedule.',
    href: '/admin/outreach/agents/outreach/setup',
    ctaLabel: 'Set up Outreach Agent',
    iconName: 'megaphone',
  },
  {
    id: 'message_drafter',
    name: 'Message Drafter',
    tagline: 'Personalized outreach ready for review',
    description:
      'Drafts email and SMS for approval, and surfaces LinkedIn steps as a separate manual sequence — review each flow in the drafter command center.',
    href: '/admin/outreach/agents/drafter',
    ctaLabel: 'Review drafts',
    iconName: 'pen-line',
  },
  {
    id: 'pipeline_analyst',
    name: 'Pipeline Analyst',
    tagline: 'Scores interest and flags follow-ups',
    description:
      'Combines ICP fit with engagement signals daily, updates lead scores, and surfaces who to contact next in your action feed.',
    href: '/admin/outreach/agents/analyst',
    ctaLabel: 'View pipeline',
    iconName: 'brain',
  },
]

export function buildSdrAgentCards(snapshot: SdrAgentSnapshot): SdrAgentCard[] {
  return SDR_AGENT_DEFINITIONS.map((agent) => {
    switch (agent.id) {
      case 'prospect_scout': {
        const configured = snapshot.prospectScoutConfigured
        const active = snapshot.prospectScoutActive
        if (!configured) {
          return {
            ...agent,
            href: '/admin/outreach/agents/setup',
            ctaLabel: 'Configure',
            status: 'needs_setup',
            statLabel: 'Status',
            statValue: 'Not configured',
          }
        }
        if (!active) {
          return {
            ...agent,
            href: '/admin/outreach/agents/scout',
            ctaLabel: 'Open agent',
            status: 'inactive',
            statLabel: 'Open prospects',
            statValue: String(snapshot.leadsInPipeline),
          }
        }
        return {
          ...agent,
          href: '/admin/outreach/agents/scout',
          ctaLabel: 'Open agent',
          status: 'active',
          statLabel: 'Open prospects',
          statValue: String(snapshot.leadsInPipeline),
        }
      }
      case 'outreach_agent': {
        const configured = snapshot.outreachAgentConfigured
        const active = snapshot.outreachAgentActive
        const auto = snapshot.automaticOutreach
        const statLabel = auto ? 'Auto campaigns' : 'Linked live'
        const statValue = auto
          ? String(snapshot.autoScoutActiveCampaigns)
          : String(snapshot.linkedActiveCampaigns)

        if (!configured) {
          return {
            ...agent,
            href: auto ? '/admin/outreach/agents/scout' : '/admin/outreach/agents/outreach/setup',
            ctaLabel: auto ? 'Set up Scout' : 'Configure',
            status: 'needs_setup',
            statLabel: 'Status',
            statValue: 'Not configured',
          }
        }
        if (!active) {
          return {
            ...agent,
            href: '/admin/outreach/agents/outreach',
            ctaLabel: 'Open agent',
            status: 'inactive',
            statLabel,
            statValue,
          }
        }
        return {
          ...agent,
          href: '/admin/outreach/campaigns',
          ctaLabel: 'View campaigns',
          status: 'active',
          statLabel,
          statValue,
        }
      }
      case 'message_drafter': {
        const pendingTotal = snapshot.pendingEmailDrafts + snapshot.pendingLinkedInDrafts
        const inAutoPipeline =
          snapshot.automaticOutreach && snapshot.prospectScoutActive && pendingTotal === 0
        const statValue =
          pendingTotal === 0
            ? inAutoPipeline
              ? 'Auto pipeline'
              : '0'
            : snapshot.pendingEmailDrafts > 0 && snapshot.pendingLinkedInDrafts > 0
              ? `${snapshot.pendingEmailDrafts} email · ${snapshot.pendingLinkedInDrafts} LinkedIn`
              : snapshot.pendingEmailDrafts > 0
                ? `${snapshot.pendingEmailDrafts} email`
                : `${snapshot.pendingLinkedInDrafts} LinkedIn`
        return {
          ...agent,
          href: '/admin/outreach/agents/drafter',
          status: pendingTotal > 0 || inAutoPipeline ? 'active' : 'idle',
          statLabel: inAutoPipeline && pendingTotal === 0 ? 'Mode' : 'Drafts to review',
          statValue,
        }
      }
      case 'pipeline_analyst':
        return {
          ...agent,
          status: snapshot.leadsInPipeline > 0 ? 'active' : 'needs_setup',
          statLabel: 'Open prospects',
          statValue: String(snapshot.leadsInPipeline),
        }
      default:
        return {
          ...agent,
          status: 'idle',
          statLabel: 'Status',
          statValue: '—',
        }
    }
  })
}

export function countActiveAgents(cards: SdrAgentCard[]): number {
  return cards.filter((card) => card.status === 'active').length
}
