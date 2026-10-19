import { LIFECYCLE_ADMIN_EMAIL } from "./lifecycle-outreach";
import { TRIAL_LEAD_CAP } from "./types";

/**
 * Trial expiry already skips this workspace, so its row stays `trialing` forever.
 * Lead and send caps must skip it too, or sourcing dies at the trial ceiling and
 * every later run looks like a search that found nothing.
 */
export function exemptFromTrialCaps(ownerEmails: readonly string[]): boolean {
  return ownerEmails.some((email) => email.trim().toLowerCase() === LIFECYCLE_ADMIN_EMAIL);
}

/** Status the trial lead cap and the trial send cap should read. */
export function statusForTrialCaps(status: string, exempt: boolean): string {
  if (exempt && status === "trialing") return "active";
  return status;
}

export type DiscoveryIdleReason = "trial_cap" | "pool_full" | "preview_full";

/**
 * Why a completed run pulled zero prospects. A zero target is an idle, not a
 * failed gate — callers must say which idle it was.
 */
export function discoveryIdleReason(input: {
  dailyCapacity: number;
  discoveryBeforeTrialClamp: number;
  discoveryTarget: number;
  totalLeads: number;
  trialing: boolean;
}): DiscoveryIdleReason | undefined {
  if (input.discoveryTarget > 0) return undefined;
  if (
    input.trialing &&
    input.totalLeads >= TRIAL_LEAD_CAP &&
    input.discoveryBeforeTrialClamp > 0
  ) {
    return "trial_cap";
  }
  if (input.dailyCapacity <= 0) return "preview_full";
  return "pool_full";
}
