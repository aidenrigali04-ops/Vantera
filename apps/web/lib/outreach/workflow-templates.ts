import type { OutreachCampaignGoal, OutreachCampaignWorkflow } from '@/lib/outreach/types'
import { CAMPAIGN_GOAL_INTENTS } from '@/lib/outreach/types'

export const CHANNEL_LABELS = {
  email: 'Email',
  linkedin: 'LinkedIn',
  sms: 'SMS',
} as const

export function defaultWorkflowForGoal(goal: OutreachCampaignGoal): OutreachCampaignWorkflow {
  const intent = CAMPAIGN_GOAL_INTENTS[goal]

  return {
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
  const steps = workflow.steps.filter((step) => step.body.trim())
  if (steps.length === 0) return 'Add at least one message step before launching'

  for (const step of steps) {
    if (step.channel === 'email' && !step.subject?.trim()) {
      return `Email step on day ${step.delayDays} needs a subject line`
    }
  }

  return null
}
