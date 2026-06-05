import {
  incrementExtensionDailySent,
  type LinkedInExtensionSession,
} from '@/lib/linkedin/accounts'
import { markCampaignStepSentCore } from '@/lib/outreach/runner'
import { markSdrLinkedInStepSent } from '@/lib/sdr/mark-linkedin-step-sent'

export async function completeExtensionLinkedInStep(input: {
  session: LinkedInExtensionSession
  stepId: string
  source: 'campaign' | 'sdr_sequence'
}): Promise<
  | { ok: true; source: 'campaign' | 'sdr_sequence'; campaignId?: string }
  | { ok: false; reason: string }
> {
  const pacing = await incrementExtensionDailySent(input.session.linkedinAccountId)
  if (!pacing.allowed) {
    return { ok: false, reason: 'daily_limit_reached' }
  }

  if (input.source === 'sdr_sequence') {
    const result = await markSdrLinkedInStepSent({
      accountId: input.session.accountId,
      stepId: input.stepId,
      actorUserId: input.session.userId,
    })
    if (!result.ok) return { ok: false, reason: result.error }
    return { ok: true, source: 'sdr_sequence' }
  }

  const result = await markCampaignStepSentCore(
    input.session.accountId,
    input.stepId,
    input.session.userId,
  )
  if (!result.ok) return { ok: false, reason: result.reason }
  return { ok: true, source: 'campaign', campaignId: result.campaignId }
}
