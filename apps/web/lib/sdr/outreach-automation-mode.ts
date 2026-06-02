/** Client-safe outreach mode helpers (no DB imports). */

export type OutreachAutomationMode = 'review' | 'automatic'

export const OUTREACH_AUTOMATION_LABELS: Record<OutreachAutomationMode, string> = {
  review: 'Review before outreach',
  automatic: 'Automatic outreach',
}

export function normalizeOutreachAutomationMode(
  value: string | null | undefined,
): OutreachAutomationMode {
  return value === 'automatic' ? 'automatic' : 'review'
}

export function isAutomaticOutreachMode(mode: OutreachAutomationMode): boolean {
  return mode === 'automatic'
}
