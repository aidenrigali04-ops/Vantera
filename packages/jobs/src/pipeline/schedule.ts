export type Cadence = "daily" | "weekly";

/** Wall-clock offset of a timezone at an instant, in ms (DST-aware via Intl). */
function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - at.getTime();
}

/** The UTC instant of local y-m-d hh:mm in a timezone (two-pass; DST edges resolve to a nearby valid instant). */
function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string
): Date {
  let utc = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    utc = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMs(timeZone, new Date(utc));
  }
  return new Date(utc);
}

function dateInTz(at: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

/** Next instant where the wall clock in `timeZone` reads `runAtTime` (HH:MM[:SS]), strictly after `after`. */
export function nextOccurrence(runAtTime: string, timeZone: string, after: Date): Date {
  const [hh = 8, mm = 0] = runAtTime.split(":").map(Number);
  const { y, m, d } = dateInTz(after, timeZone);
  const today = zonedTimeToUtc(y, m, d, hh, mm, timeZone);
  if (today.getTime() > after.getTime()) return today;
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  anchor.setUTCDate(anchor.getUTCDate() + 1);
  return zonedTimeToUtc(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    anchor.getUTCDate(),
    hh,
    mm,
    timeZone
  );
}

/**
 * Advance an agent's schedule after a run. Daily: the next wall-clock occurrence.
 * Weekly: ~7 days out at the same wall-clock time (6-day shift, then next occurrence,
 * so DST transitions keep the run at the user's chosen local time).
 */
export function computeNextRunAt(
  runAtTime: string,
  cadence: Cadence,
  timeZone: string,
  from: Date
): Date {
  const base = cadence === "weekly" ? new Date(from.getTime() + 6 * 86_400_000) : from;
  return nextOccurrence(runAtTime, timeZone, base);
}
