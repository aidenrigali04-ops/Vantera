import { logSdrActivity } from '@/lib/sdr/activity-log'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'

/** Logs to shared sdr_activity_log but tagged for Outreach Agent feed only. */
export async function logOutreachAgentActivity(
  accountId: string,
  input: {
    eventType: string
    leadId?: string | null
    sequenceId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const scoutConfig = await findSdrConfigByAccount(accountId)
  if (!scoutConfig) return

  await logSdrActivity({
    accountId,
    configId: scoutConfig.id,
    leadId: input.leadId,
    sequenceId: input.sequenceId,
    eventType: input.eventType,
    metadata: {
      agent: 'outreach_agent',
      ...input.metadata,
    },
  })
}
