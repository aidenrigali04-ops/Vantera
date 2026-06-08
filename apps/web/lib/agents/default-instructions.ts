import type { SdrAgentId } from '@/lib/agents/types'

export const AGENT_DEFAULT_INSTRUCTIONS: Record<SdrAgentId, string> = {
  prospect_scout:
    'Discover and score prospects that match the workspace ICP. Prioritize quality over volume — only enroll leads above the ICP floor. Deduplicate against existing contacts before adding to the pipeline. Run on the configured schedule and surface every discovery event in the activity log.',
  message_drafter:
    'Draft personalized email and SMS outreach using lead context, company signals, and sequence step goals. Keep copy concise, specific, and human. Never send without review when workspace mode is Manual. Surface LinkedIn steps separately for manual delivery.',
  outreach_agent:
    'Orchestrate linked campaigns on schedule — email, SMS, and LinkedIn steps. Respect outreach windows and pause states. In Automatic mode, launch campaigns after Scout runs. Flag manual LinkedIn steps for human approval before marking sent.',
  pipeline_analyst:
    'Score lead interest daily using ICP fit and engagement signals. Update lead scores when replies, meetings, or campaign events occur. Surface high-intent prospects in the action feed so reps know who to contact next.',
}

export const AGENT_PAGE_COPY: Record<
  SdrAgentId,
  { title: string; subtitle: string; defaultName: string; defaultDescription: string }
> = {
  prospect_scout: {
    title: 'Prospect Scout',
    subtitle: 'Configure discovery, scoring, and enrollment — analytics update live as runs complete.',
    defaultName: 'Prospect Scout',
    defaultDescription: 'Finds ICP-matched leads on schedule and adds qualified prospects to your pipeline.',
  },
  message_drafter: {
    title: 'Message Drafter',
    subtitle: 'Set how copy is drafted and reviewed before it reaches prospects.',
    defaultName: 'Message Drafter',
    defaultDescription: 'Writes personalized email and SMS for your review before send.',
  },
  outreach_agent: {
    title: 'Outreach Agent',
    subtitle: 'Link campaigns and control how sequences run across channels.',
    defaultName: 'Outreach Agent',
    defaultDescription: 'Runs email, LinkedIn, and SMS sequences for linked campaigns.',
  },
  pipeline_analyst: {
    title: 'Pipeline Analyst',
    subtitle: 'Tune scoring behavior and monitor pipeline health from engagement signals.',
    defaultName: 'Pipeline Analyst',
    defaultDescription: 'Scores interest and flags follow-ups based on ICP fit and engagement.',
  },
}
