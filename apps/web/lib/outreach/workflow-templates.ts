import {
  LINKEDIN_NOTE_CHAR_LIMIT,
  type CampaignChannelFocus,
  type CampaignDeliveryMode,
} from '@/lib/outreach/campaign-draft-guidelines'
import type { OutreachCampaignGoal, OutreachCampaignWorkflow } from '@/lib/outreach/types'
import { CAMPAIGN_GOAL_INTENTS } from '@/lib/outreach/types'

export const CHANNEL_LABELS = {
  email: 'Email',
  linkedin: 'LinkedIn',
  sms: 'SMS',
} as const

export function singleLinkedInWorkflowForGoal(goal: OutreachCampaignGoal): OutreachCampaignWorkflow {
  return {
    deliveryMode: 'single_linkedin',
    channelFocus: 'linkedin',
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        channel: 'linkedin',
        intent:
          'Write a short LinkedIn connection note — under 300 characters, no pitch, peer tone.',
        body: '',
      },
    ],
  }
}

export function linkedinSequenceWorkflowForGoal(goal: OutreachCampaignGoal): OutreachCampaignWorkflow {
  const intent = CAMPAIGN_GOAL_INTENTS[goal]
  return {
    deliveryMode: 'linkedin_sequence',
    channelFocus: 'linkedin',
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        channel: 'linkedin',
        intent:
          'Write a short LinkedIn connection note — under 300 characters, no pitch.',
        body: '',
      },
      {
        stepIndex: 1,
        delayDays: 3,
        channel: 'linkedin',
        intent: 'Brief follow-up DM if connected — still under 300 characters, one soft CTA.',
        body: '',
      },
      {
        stepIndex: 2,
        delayDays: 7,
        channel: 'linkedin',
        intent: `Final LinkedIn touch: ${intent} Keep under 300 characters.`,
        body: '',
      },
    ],
  }
}

export function singleEmailWorkflowForGoal(goal: OutreachCampaignGoal): OutreachCampaignWorkflow {
  return {
    deliveryMode: 'single_email',
    channelFocus: 'email',
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        channel: 'email',
        intent: CAMPAIGN_GOAL_INTENTS[goal],
        subject: '',
        body: '',
      },
    ],
  }
}

export function defaultWorkflowForGoal(
  goal: OutreachCampaignGoal,
  deliveryMode: CampaignDeliveryMode = 'sequence',
  channelFocus: CampaignChannelFocus = 'email',
): OutreachCampaignWorkflow {
  if (deliveryMode === 'single_email') return singleEmailWorkflowForGoal(goal)
  if (deliveryMode === 'single_linkedin') return singleLinkedInWorkflowForGoal(goal)
  if (deliveryMode === 'linkedin_sequence') return linkedinSequenceWorkflowForGoal(goal)
  if (channelFocus === 'linkedin') return linkedinSequenceWorkflowForGoal(goal)

  const intent = CAMPAIGN_GOAL_INTENTS[goal]

  return {
    deliveryMode: 'sequence',
    channelFocus: 'email',
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        channel: 'email',
        intent,
        subject: '',
        body: '',
      },
      {
        stepIndex: 1,
        delayDays: 2,
        channel: 'linkedin',
        intent: 'Write a short LinkedIn connection note — under 300 characters, no pitch.',
        body: '',
      },
      {
        stepIndex: 2,
        delayDays: 5,
        channel: 'email',
        intent: 'Write a brief follow-up email referencing the earlier outreach.',
        subject: '',
        body: '',
      },
    ],
  }
}

export function channelsFromWorkflow(workflow: OutreachCampaignWorkflow): string[] {
  const channels = new Set(workflow.steps.map((step) => step.channel))
  return Array.from(channels)
}

export function normalizeWorkflowSteps(
  steps: OutreachCampaignWorkflow['steps'],
): OutreachCampaignWorkflow['steps'] {
  return steps
    .map((step, index) => ({
      ...step,
      stepIndex: index,
      delayDays: Math.max(0, Number(step.delayDays) || 0),
      body: step.body?.trim() ?? '',
      subject: step.subject?.trim() ?? '',
    }))
    .filter((step) => step.body.length > 0 || step.channel === 'email')
}

export function validateWorkflowForLaunch(workflow: OutreachCampaignWorkflow): string | null {
  const mode = workflow.deliveryMode ?? 'sequence'
  const isSingleEmail = mode === 'single_email'
  const isSingleLinkedIn = mode === 'single_linkedin'
  const steps = workflow.steps.filter((step) => step.body.trim())

  if (steps.length === 0) {
    if (isSingleEmail) return 'Write your email before launching'
    if (isSingleLinkedIn) return 'Write your connection note before launching'
    return 'Add at least one message step before launching'
  }

  for (const step of steps) {
    if (step.channel === 'email' && !step.subject?.trim()) {
      return isSingleEmail
        ? 'Add an email subject line before launching'
        : `Email step on day ${step.delayDays} needs a subject line`
    }
    if (step.channel === 'linkedin' && step.body.length > LINKEDIN_NOTE_CHAR_LIMIT) {
      return `LinkedIn step on day ${step.delayDays} must be ${LINKEDIN_NOTE_CHAR_LIMIT} characters or fewer (currently ${step.body.length})`
    }
  }

  if (isSingleEmail) {
    const emailSteps = workflow.steps.filter((s) => s.channel === 'email' && s.body.trim())
    if (emailSteps.length === 0) return 'One-time email campaigns need a complete email step'
  }

  if (isSingleLinkedIn) {
    const li = workflow.steps.find((s) => s.channel === 'linkedin' && s.body.trim())
    if (!li) return 'Add your LinkedIn connection note before launching'
  }

  return null
}
