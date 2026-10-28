/**
 * Client-safe copy for the LinkedIn safety caps: numbers in, strings out. The numbers come
 * from packages/jobs/src/pipeline/safety-limits.ts, read by a server component and passed
 * down — this file never imports the jobs package, so it can ship to the browser.
 */

/** Mirrors the shape of LINKEDIN_RAMP in safety-limits.ts. */
export type RampStep = { maxAgeDays: number; daily: number };

export type CapsInput = {
  dailyInvites: number;
  dailyMessages: number;
  weeklyInvites: number;
  ramp: RampStep[];
};

const WEEK_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** "over the first week" / "over the first four weeks" — the one ramp-period clause both lines use. */
function rampPeriod(ramp: RampStep[]): string {
  const weeks = Math.max(1, Math.round((ramp.at(-1)?.maxAgeDays ?? 0) / 7));
  if (weeks === 1) return "over the first week";
  return `over the first ${WEEK_WORDS[weeks] ?? String(weeks)} weeks`;
}

/** "5 → 10 → 15 → 20/day over the first four weeks" */
export function rampLabel(ramp: CapsInput["ramp"], steady: number): string {
  if (ramp.length === 0) return `${steady}/day`;
  return `${[...ramp.map((s) => s.daily), steady].join(" → ")}/day ${rampPeriod(ramp)}`;
}

/** One trust sentence stating the real caps. */
export function capsTrustLine(c: CapsInput): string {
  const rampClause =
    c.ramp.length > 0 ? ` once ramped (${c.ramp.map((s) => s.daily).join(" → ")} ${rampPeriod(c.ramp)})` : "";
  return (
    `Sends stay within LinkedIn-safe limits: ${c.dailyInvites} invites a day${rampClause}, ` +
    `${c.dailyMessages} messages a day, about ${c.weeklyInvites} invites a week.`
  );
}
