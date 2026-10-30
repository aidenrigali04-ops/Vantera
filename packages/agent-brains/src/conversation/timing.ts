/**
 * Human-plausible reply timing. Pure: no model, no DB. The pipeline decides WHEN to send; this only
 * says how long a person would plausibly take and when the prospect's night ends.
 */
export const REPLY_DELAY_MIN_MS = 4 * 60_000;
export const REPLY_DELAY_MAX_MS = 3 * 3_600_000;
/** Local quiet window: [21:00, 07:00) in the prospect's timezone. */
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 7;

/**
 * Log-scaled delay: reading their message and writing ours both take longer as they grow, with
 * diminishing returns. Jittered x(0.6..1.6) and clamped to [4 min, 3 h].
 */
export function replyDelayMs(theirChars: number, ourChars: number, rng: () => number): number {
  const base =
    REPLY_DELAY_MIN_MS +
    6 * 60_000 * Math.log(1 + Math.max(0, theirChars) / 80) +
    4 * 60_000 * Math.log(1 + Math.max(0, ourChars) / 80);
  const jittered = base * (0.6 + rng() * 1.0);
  return Math.min(REPLY_DELAY_MAX_MS, Math.max(REPLY_DELAY_MIN_MS, jittered));
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(now: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const get = (type: string): number => Number(fmt.formatToParts(now).find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute"), second: get("second") };
}

export function isQuietHour(now: Date, tz: string): boolean {
  const { hour } = localParts(now, tz);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** Next instant at 07:00 local in `tz`: today if it is before 07:00 local, else tomorrow. */
export function nextQuietExit(now: Date, tz: string): Date {
  const p = localParts(now, tz);
  const dayOffset = p.hour < QUIET_END_HOUR ? 0 : 1;
  // Wall-clock 07:00 on the target date, expressed as if it were UTC.
  const wall = Date.UTC(p.year, p.month - 1, p.day + dayOffset, QUIET_END_HOUR, 0, 0);
  // Resolve the zone offset at the candidate instant; iterate so DST boundaries converge.
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const g = localParts(new Date(guess), tz);
    const asUtc = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute, g.second);
    const next = guess + (wall - asUtc);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}
