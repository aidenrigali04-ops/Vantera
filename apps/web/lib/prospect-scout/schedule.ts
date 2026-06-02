import type { SdrConfigRow } from '@/lib/prospect-scout/types'

/** Whether this config should run on the current scheduled cron tick (UTC). */
export function shouldRunProspectScoutOnSchedule(
  config: Pick<SdrConfigRow, 'searchFrequency'>,
  now: Date = new Date(),
): boolean {
  const frequency = config.searchFrequency ?? 'daily'
  if (frequency === 'daily') return true
  // Weekly: Monday 06:00 UTC cron window
  return now.getUTCDay() === 1
}
