import type { SdrConfigRow } from '@/lib/prospect-scout/types'

/** Local hour (workspace timezone) for daily Prospect Scout cron pulls in Automatic mode. */
export const PROSPECT_SCOUT_SCHEDULED_LOCAL_HOUR = 8

const DEFAULT_SCOUT_TIMEZONE = 'America/New_York'

export function resolveScoutScheduleTimezone(timezone: string | null | undefined): string {
  const trimmed = timezone?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_SCOUT_TIMEZONE
}

export function getAccountLocalTimeParts(
  now: Date,
  timeZone: string,
): { hour: number; minute: number; weekdayShort: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0'

  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekdayShort: get('weekday'),
  }
}

/**
 * Whether this config should run on the current hourly cron tick.
 * Automatic-mode scheduled runs only: daily at 8:00 AM workspace time, or Mondays for weekly.
 */
export function shouldRunProspectScoutOnSchedule(
  config: Pick<SdrConfigRow, 'searchFrequency'>,
  options?: { now?: Date; timezone?: string | null },
): boolean {
  const now = options?.now ?? new Date()
  const tz = resolveScoutScheduleTimezone(options?.timezone)
  const { hour, minute, weekdayShort } = getAccountLocalTimeParts(now, tz)

  if (hour !== PROSPECT_SCOUT_SCHEDULED_LOCAL_HOUR) return false
  // Hourly cron fires at :00; allow a short window for Trigger drift.
  if (minute > 14) return false

  const frequency = config.searchFrequency ?? 'daily'
  if (frequency === 'weekly') {
    return weekdayShort === 'Mon'
  }

  return true
}
