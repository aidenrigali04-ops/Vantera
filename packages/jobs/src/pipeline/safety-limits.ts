/**
 * LinkedIn safety limits (rule 04). These ceilings protect the USER'S OWN LinkedIn account
 * from restriction — treat them as compliance, not preference. They live here in the
 * scheduler, never in the provider, and callers cannot configure outreach volume above them
 * (requests are clamped). Every send path must call dailyAllowance() first.
 */

export const LINKEDIN_WEEKLY_INVITE_CEILING = 100;
export const LINKEDIN_STEADY_DAILY_INVITES = 20; // ~100/week across weekdays
export const LINKEDIN_STEADY_DAILY_MESSAGES = 25; // conservative; non-configurable (rule 04)

/** new-account ramp: stay tiny while the account builds history */
const LINKEDIN_RAMP: { maxAgeDays: number; daily: number }[] = [
  { maxAgeDays: 7, daily: 5 },
  { maxAgeDays: 14, daily: 10 },
  { maxAgeDays: 28, daily: 15 },
];

export type SafetyChannel = "linkedin";
export type LinkedInSendKind = "invite" | "message";

function channelCeiling(_channel: SafetyChannel, accountAgeDays: number, kind: LinkedInSendKind): number {
  if (kind === "message") return LINKEDIN_STEADY_DAILY_MESSAGES;
  const step = LINKEDIN_RAMP.find((s) => accountAgeDays < s.maxAgeDays);
  return step ? step.daily : LINKEDIN_STEADY_DAILY_INVITES;
}

/** Max sends allowed today. `requested` may lower the volume, never raise it. */
export function dailyAllowance(
  channel: SafetyChannel,
  accountAgeDays: number,
  options?: { requested?: number; kind?: LinkedInSendKind }
): number {
  const ceiling = channelCeiling(channel, Math.max(0, accountAgeDays), options?.kind ?? "invite");
  if (options?.requested === undefined) return ceiling;
  return Math.max(0, Math.min(options.requested, ceiling));
}

/** Deterministic ±30% jitter so sends pace like a human, not a metronome. */
export function paceWithJitter(baseMs: number, seed: number): number {
  const x = Math.sin(seed + 1) * 10_000;
  const frac = x - Math.floor(x); // [0, 1)
  return Math.round(baseMs * (0.7 + 0.6 * frac));
}
