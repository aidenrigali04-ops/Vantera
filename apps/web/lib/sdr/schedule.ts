import type { SdrOutreachWindow, SDRSequenceStep } from '@/lib/sdr/types'

function dayCode(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz })
    .format(date)
    .slice(0, 3)
    .toLowerCase()
}

function setHourInTz(base: Date, hour: number, tz: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(base)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const y = Number(get('year'))
  const m = Number(get('month'))
  const d = Number(get('day'))

  const utcGuess = Date.UTC(y, m - 1, d, hour, 0, 0)
  const offsetMs = getTzOffsetMs(new Date(utcGuess), tz)
  return new Date(utcGuess - offsetMs)
}

function getTzOffsetMs(date: Date, tz: string): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const local = new Date(date.toLocaleString('en-US', { timeZone: tz }))
  return local.getTime() - utc.getTime()
}

export function isWithinOutreachWindow(now: Date, window: SdrOutreachWindow): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: window.tz,
      hour: 'numeric',
      hour12: false,
    }).format(now),
  )
  return hour >= window.startHour && hour < window.endHour
}

export function isOutreachDay(now: Date, outreachDays: string[], tz: string): boolean {
  const code = dayCode(now, tz)
  return outreachDays.includes(code)
}

function nextOutreachDayStart(from: Date, outreachDays: string[], window: SdrOutreachWindow): Date {
  const cursor = new Date(from)
  for (let i = 0; i < 14; i++) {
    if (isOutreachDay(cursor, outreachDays, window.tz)) {
      const start = setHourInTz(cursor, window.startHour, window.tz)
      if (start >= from) return start
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return setHourInTz(from, window.startHour, window.tz)
}

export function scheduleSequenceSteps(
  steps: SDRSequenceStep[],
  outreachDays: string[],
  window: SdrOutreachWindow,
  from = new Date(),
): Date[] {
  const base = nextOutreachDayStart(from, outreachDays, window)
  const scheduled: Date[] = []
  let lastDayKey: string | null = null

  for (const step of steps) {
    let target = new Date(base.getTime() + step.dayOffset * 86_400_000)

    for (let guard = 0; guard < 30; guard++) {
      if (!isOutreachDay(target, outreachDays, window.tz)) {
        target = new Date(target.getTime() + 86_400_000)
        continue
      }

      const dayKey = target.toISOString().slice(0, 10)
      if (dayKey === lastDayKey) {
        target = new Date(target.getTime() + 86_400_000)
        continue
      }

      const sendAt = setHourInTz(target, window.startHour, window.tz)
      if (sendAt < from) {
        target = new Date(target.getTime() + 86_400_000)
        continue
      }

      scheduled.push(sendAt)
      lastDayKey = dayKey
      break
    }
  }

  return scheduled
}

export function segmentKey(vertical: string, employeeCount: number | null): string {
  const size =
    employeeCount == null
      ? 'unknown'
      : employeeCount <= 10
        ? 'small'
        : employeeCount <= 50
          ? 'mid'
          : 'large'
  return `${vertical}_${size}`
}
