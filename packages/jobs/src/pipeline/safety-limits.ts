/**
 * Channel safety limits (rule 04). These ceilings protect the USER'S OWN accounts
 * from provider restriction — treat them as compliance, not preference. They live
 * here in the scheduler, never in the provider, and callers cannot configure
 * outreach volume above them (requests are clamped). Enforced for real at the
 * Phase 5 send boundary; every send path must call dailyAllowance() first.
 */

export const LINKEDIN_WEEKLY_INVITE_CEILING = 100;
export const LINKEDIN_STEADY_DAILY_INVITES = 20; // ~100/week across weekdays

/** new-account ramp: stay tiny while the account builds history */
const LINKEDIN_RAMP: { maxAgeDays: number; daily: number }[] = [
  { maxAgeDays: 7, daily: 5 },
  { maxAgeDays: 14, daily: 10 },
  { maxAgeDays: 28, daily: 15 },
];

export const EMAIL_STEADY_DAILY_PER_MAILBOX = 30; // warmup-safe; revisited with Phase 5 warmup gating

export type SafetyChannel = "linkedin" | "email";

function channelCeiling(channel: SafetyChannel, accountAgeDays: number): number {
  if (channel === "email") return EMAIL_STEADY_DAILY_PER_MAILBOX;
  const step = LINKEDIN_RAMP.find((s) => accountAgeDays < s.maxAgeDays);
  return step ? step.daily : LINKEDIN_STEADY_DAILY_INVITES;
}

/** Max sends allowed today. `requested` may lower the volume, never raise it. */
export function dailyAllowance(
  channel: SafetyChannel,
  accountAgeDays: number,
  requested?: number
): number {
  const ceiling = channelCeiling(channel, Math.max(0, accountAgeDays));
  if (requested === undefined) return ceiling;
  return Math.max(0, Math.min(requested, ceiling));
}

/** Deterministic ±30% jitter so sends pace like a human, not a metronome. */
export function paceWithJitter(baseMs: number, seed: number): number {
  const x = Math.sin(seed + 1) * 10_000;
  const frac = x - Math.floor(x); // [0, 1)
  return Math.round(baseMs * (0.7 + 0.6 * frac));
}
