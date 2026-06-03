import { findOutreachAgentConfigByAccount } from '@/lib/outreach-agent/queries'

/**
 * When the Outreach Agent is paused, cron should not send steps for linked campaigns.
 * Manual "Run queue" is blocked separately in runLinkedCampaignQueueNow.
 */
export async function getPausedLinkedCampaignExclusions(
  accountId: string,
): Promise<string[]> {
  const config = await findOutreachAgentConfigByAccount(accountId)
  if (!config?.isPaused || config.linkedCampaignIds.length === 0) {
    return []
  }
  return config.linkedCampaignIds
}
