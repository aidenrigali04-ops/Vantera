import type { TrialExpiryDeps, TrialExpirySummary } from "./types";

/**
 * Lapse no-card free trials whose end date has passed (migration 0019). The store
 * filters by status='trialing' + trial_ends_at < now + no Stripe subscription, then
 * `expireTrials` flips them to the canceled end-state (plan='none', status='none',
 * outreach paused) so the first-deploy gate re-blocks and outreach stops. Trials that
 * converted to a paid plan are already status='active' and never selected.
 */
export async function runTrialExpiry(deps: TrialExpiryDeps): Promise<TrialExpirySummary> {
  const now = deps.now ? deps.now() : new Date();
  const expired = await deps.store.getExpiredTrialAccounts(now);
  // 0045: capture BEFORE the flip — post-expiry these rows are indistinguishable from any
  // canceled account, so the moment of lapse is the only clean capture point.
  if (expired.length > 0 && deps.lifecycle) {
    await deps.lifecycle.enqueueTrialLapsedForAccounts(expired.map((a) => a.id));
  }
  const count = expired.length > 0 ? await deps.store.expireTrials(expired.map((a) => a.id)) : 0;
  return { status: "completed", expired: count };
}
