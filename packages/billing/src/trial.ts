import type { PlanTier } from "./plans";

/**
 * No-card free trial. New accounts start here (granted by DB column defaults in
 * migration 0020, shortened in 0037, lengthened to 5 days in 0045). The first-deploy
 * gate passes because `subscriptionStatus` is 'trialing' (isActive) on a real tier —
 * see entitlements.isActive.
 */
export const TRIAL_TIER: PlanTier = "starter";

/** Trial length in days. Must match the `now() + interval '5 days'` default in 0045. */
export const TRIAL_DAYS = 5;

/**
 * Whole days remaining in the trial (rounded up), floored at 0. Null when the
 * account isn't on a trial (no trial_ends_at). Drives the "N days left" UI.
 */
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** True once a trial's end date has passed — the trial-expiry cron's predicate. */
export function isTrialExpired(trialEndsAt: string | null, now: Date = new Date()): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() <= now.getTime();
}
