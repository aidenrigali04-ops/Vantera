import type {
  OutreachCampaignMetrics,
  OutreachCampaignWorkflow,
  outreachCampaigns,
  outreachCampaignEnrollments,
  outreachCampaignSteps,
  leads,
} from '@vantera/db'

export type { OutreachCampaignWorkflow, OutreachCampaignWorkflowStep } from '@vantera/db'

export type OutreachCampaignRow = typeof outreachCampaigns.$inferSelect
export type OutreachEnrollmentRow = typeof outreachCampaignEnrollments.$inferSelect
export type OutreachStepRow = typeof outreachCampaignSteps.$inferSelect
export type LeadRow = typeof leads.$inferSelect

export type OutreachCampaignGoal = OutreachCampaignRow['goal']

export const CAMPAIGN_GOAL_LABELS: Record<OutreachCampaignGoal, string> = {
  book_meeting: 'Book meetings',
  fill_funnel: 'Fill top of funnel',
  re_engage: 'Re-engage stalled leads',
}

export const CAMPAIGN_GOAL_INTENTS: Record<OutreachCampaignGoal, string> = {
  book_meeting:
    'Write a concise cold email that introduces the business and invites a short discovery call.',
  fill_funnel:
    'Write a concise cold email that sparks interest and offers a clear reason to reply.',
  re_engage:
    'Write a friendly follow-up email that re-opens the conversation without pressure.',
}

export type CampaignWithStats = OutreachCampaignRow & {
  metrics: OutreachCampaignMetrics
  workflow: OutreachCampaignWorkflow
}

export type EnrollmentWithLead = OutreachEnrollmentRow & {
  lead: LeadRow
}

export function parseCampaignWorkflow(raw: unknown): OutreachCampaignWorkflow {
  if (!raw || typeof raw !== 'object') return { steps: [] }
  const workflow = raw as OutreachCampaignWorkflow
  if (!Array.isArray(workflow.steps)) return { steps: [] }
  return workflow
}

export function parseCampaignMetrics(raw: unknown): OutreachCampaignMetrics {
  const fallback: OutreachCampaignMetrics = {
    enrolled: 0,
    sent: 0,
    failed: 0,
    replied: 0,
    meetings: 0,
  }
  if (!raw || typeof raw !== 'object') return fallback
  const m = raw as Partial<OutreachCampaignMetrics>
  return {
    enrolled: Number(m.enrolled ?? 0),
    sent: Number(m.sent ?? 0),
    failed: Number(m.failed ?? 0),
    replied: Number(m.replied ?? 0),
    meetings: Number(m.meetings ?? 0),
  }
}

const MERGE_TOKEN_PATTERN =
  /\{\{(first_name|last_name|company|title|email)\}\}/i

export function hasMergeTokens(template: string): boolean {
  return MERGE_TOKEN_PATTERN.test(template)
}

export function personalizeTemplate(
  template: string,
  lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company' | 'email' | 'title'>,
): string {
  const firstName = lead.firstName ?? 'there'
  const lastName = lead.lastName ?? ''
  return template
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{company\}\}/gi, lead.company ?? 'your company')
    .replace(/\{\{title\}\}/gi, lead.title ?? 'your role')
    .replace(/\{\{email\}\}/gi, lead.email ?? '')
}

/**
 * Sends stored copy as-is when it was already finalized (no merge tags).
 * Applies merge tags only when the template still contains {{first_name}}, etc.
 */
export function resolveOutboundCopy(
  template: string,
  lead: Pick<LeadRow, 'firstName' | 'lastName' | 'company' | 'email' | 'title'>,
): string {
  if (!template || !hasMergeTokens(template)) return template
  return personalizeTemplate(template, lead)
}
