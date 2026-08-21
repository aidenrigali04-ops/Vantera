import {
  snapshotFromEvent,
  type CheckoutSessionResult,
  type PersistedSnapshot,
} from "@vantera/billing";

export type ConfirmDecision =
  | { apply: true; snapshot: PersistedSnapshot }
  | { apply: false; reason: "unknown-session" | "not-complete" | "wrong-account" | "no-subscription" };

/**
 * Pure guard for confirming a checkout return (no IO — `confirm-checkout-server.ts` does the
 * reading and writing). The `session_id` on the success URL is attacker-supplyable, so the
 * session is only ever applied to the tenant it was actually opened for: we compare the
 * provider's `client_reference_id` against the account resolved from the caller's session.
 */
export function decideCheckoutConfirmation(
  session: CheckoutSessionResult | null,
  sessionAccountId: string
): ConfirmDecision {
  if (!session) return { apply: false, reason: "unknown-session" };
  if (!session.complete) return { apply: false, reason: "not-complete" };
  // Never let a session id from another workspace write billing state into this one.
  if (!session.accountId || session.accountId !== sessionAccountId) {
    return { apply: false, reason: "wrong-account" };
  }
  if (!session.subscription) return { apply: false, reason: "no-subscription" };

  const snapshot = snapshotFromEvent(session.subscription);
  if (!snapshot) return { apply: false, reason: "no-subscription" };
  return { apply: true, snapshot };
}
