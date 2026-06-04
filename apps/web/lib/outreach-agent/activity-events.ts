/** Event types and filters for Outreach Agent activity (separate from Prospect Scout feed). */

export const OUTREACH_AGENT_EVENT_TYPES = new Set([
  'outreach_agent_launched',
  'outreach_agent_paused',
  'outreach_agent_resumed',
  'outreach_queue_run',
  'auto_campaign_launched',
])

export function isOutreachAgentActivityEvent(
  eventType: string,
  metadata: Record<string, unknown>,
): boolean {
  if (metadata.agent === 'outreach_agent') return true
  if (OUTREACH_AGENT_EVENT_TYPES.has(eventType)) return true
  if (
    (eventType === 'email_sent' || eventType === 'sms_sent') &&
    metadata.source === 'auto_scout_campaign'
  ) {
    return true
  }
  return false
}

export function isScoutActivityEvent(eventType: string, metadata: Record<string, unknown>): boolean {
  return !isOutreachAgentActivityEvent(eventType, metadata)
}
