import { findActiveAutoScoutCampaignIds } from '@/lib/outreach/automatic-scout-campaign'
import { findOutreachAgentConfigByAccount } from '@/lib/outreach-agent/queries'
import {
  isAccountAutomaticOutreach,
  shouldCronAutoProcessCampaignSteps,
} from '@/lib/sdr/outreach-automation-account'
import { sendDueSdrStepsForAccount } from '@/lib/sdr/send-due-for-account'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'

export { isAccountAutomaticOutreach, shouldCronAutoProcessCampaignSteps }

/**
 * Automatic mode: send due steps on auto-generated Scout campaigns (personalized copy).
 * Manual review mode: SDR sequences + optional linked manual campaigns.
 */
export async function flushAutomaticOutreachPipelines(
  accountId: string,
): Promise<{ sdrSent: number; sdrFailed: number; campaignSent: number }> {
  const empty = { sdrSent: 0, sdrFailed: 0, campaignSent: 0 }
  if (!(await isAccountAutomaticOutreach(accountId))) return empty

  const ownerId = await resolveAccountOwnerId(accountId)
  if (!ownerId) return empty

  const { processDueCampaignSteps } = await import('@/lib/outreach/runner')

  const autoCampaignIds = await findActiveAutoScoutCampaignIds(accountId)
  let campaignSent = 0

  if (autoCampaignIds.length > 0) {
    const campaignSummary = await processDueCampaignSteps(accountId, ownerId, {
      campaignIds: autoCampaignIds,
    }).catch((error) => {
      console.error('[outreach-automation] auto scout campaign send failed', accountId, error)
      return { sent: 0, failed: 0 }
    })
    campaignSent = campaignSummary.sent
  }

  return {
    sdrSent: 0,
    sdrFailed: 0,
    campaignSent,
  }
}

/** Manual mode: linked campaigns + SDR sequence sends. */
export async function flushManualOutreachPipelines(
  accountId: string,
): Promise<{ sdrSent: number; sdrFailed: number; campaignSent: number }> {
  const sdrSummary = await sendDueSdrStepsForAccount(accountId).catch((error) => {
    console.error('[outreach-automation] SDR send flush failed', accountId, error)
    return { sent: 0, failed: 0 }
  })

  const agent = await findOutreachAgentConfigByAccount(accountId)
  if (!agent || agent.isPaused || agent.linkedCampaignIds.length === 0) {
    return {
      sdrSent: sdrSummary.sent,
      sdrFailed: sdrSummary.failed,
      campaignSent: 0,
    }
  }

  const ownerId = await resolveAccountOwnerId(accountId)
  if (!ownerId) {
    return {
      sdrSent: sdrSummary.sent,
      sdrFailed: sdrSummary.failed,
      campaignSent: 0,
    }
  }

  const { processDueCampaignSteps } = await import('@/lib/outreach/runner')
  const campaignSummary = await processDueCampaignSteps(accountId, ownerId, {
    campaignIds: agent.linkedCampaignIds,
  }).catch((error) => {
    console.error('[outreach-automation] linked campaign flush failed', accountId, error)
    return { sent: 0, failed: 0 }
  })

  return {
    sdrSent: sdrSummary.sent,
    sdrFailed: sdrSummary.failed,
    campaignSent: campaignSummary.sent,
  }
}
