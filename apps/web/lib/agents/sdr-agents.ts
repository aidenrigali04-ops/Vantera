import type { SdrAgentCard, SdrAgentDefinition, SdrAgentSnapshot } from '@/lib/agents/types'
import { Brain, Megaphone, PenLine, Telescope } from 'lucide-react'

export const SDR_AGENTS_HEADLINE = 'Build your SDR Agents'
export const SDR_AGENTS_SUBHEADLINE =
  'Deploy AI agents that find, contact, and nurture leads around the clock — without adding headcount. Your pipeline never sleeps.'

export const SDR_AGENT_DEFINITIONS: SdrAgentDefinition[] = [
  {
    id: 'prospect_scout',
    name: 'Prospect Scout',
    tagline: 'Finds ICP-matched leads while you sleep',
    description:
      'Runs saved Aspire searches on a weekly schedule, scores prospects against your ICP, and surfaces high-fit matches to your pipeline.',
    href: '/admin/outreach/aspire',
    ctaLabel: 'Configure scout',
    icon: Telescope,
  },
  {
    id: 'outreach_agent',
    name: 'Outreach Agent',
    tagline: 'Runs email, LinkedIn, and SMS sequences',
    description:
      'Enrolls leads into multi-step campaigns, sends on schedule, and queues LinkedIn steps for you to approve with one click.',
    href: '/admin/outreach/campaigns',
    ctaLabel: 'Launch campaign',
    icon: Megaphone,
  },
  {
    id: 'message_drafter',
    name: 'Message Drafter',
    tagline: 'Personalized outreach ready for review',
    description:
      'Drafts tailored email and SMS messages when prospects enroll — you approve from the dashboard or let autonomous mode send.',
    href: '/admin/dashboard',
    ctaLabel: 'Review drafts',
    icon: PenLine,
  },
  {
    id: 'pipeline_analyst',
    name: 'Pipeline Analyst',
    tagline: 'Scores interest and flags follow-ups',
    description:
      'Combines ICP fit with engagement signals daily, updates lead scores, and surfaces who to contact next in your action feed.',
    href: '/admin/pipeline',
    ctaLabel: 'View pipeline',
    icon: Brain,
  },
]

export function buildSdrAgentCards(snapshot: SdrAgentSnapshot): SdrAgentCard[] {
  return SDR_AGENT_DEFINITIONS.map((agent) => {
    switch (agent.id) {
      case 'prospect_scout':
        return {
          ...agent,
          status: snapshot.activeSavedSearches > 0 ? 'active' : 'needs_setup',
          statLabel: 'Active searches',
          statValue: String(snapshot.activeSavedSearches),
        }
      case 'outreach_agent':
        return {
          ...agent,
          status:
            snapshot.activeCampaigns > 0
              ? 'active'
              : snapshot.draftCampaigns > 0
                ? 'idle'
                : 'needs_setup',
          statLabel: 'Live campaigns',
          statValue: String(snapshot.activeCampaigns),
        }
      case 'message_drafter':
        return {
          ...agent,
          status: snapshot.pendingDrafts > 0 ? 'active' : 'idle',
          statLabel: 'Drafts to review',
          statValue: String(snapshot.pendingDrafts),
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
