import "server-only";
import { createBillingFromEnv, isActive } from "@vantera/billing";
import { createServiceClient } from "@/lib/supabase/service";
import { decideCheckoutConfirmation } from "./confirm-checkout";

/**
 * Confirm a checkout return directly with the provider and persist the same snapshot the
 * webhook would have written.
 *
 * Why this exists: treating the webhook as the only fulfilment path means any delayed,
 * dropped, or (in local development) unreachable webhook leaves the customer watching a
 * spinner after they have already paid. The provider's own record of the session is
 * authoritative, so the success redirect can confirm itself. Both paths write identical
 * columns and are idempotent, so whichever arrives first wins and the other is a no-op.
 *
 * `accountId` MUST come from the caller's session — it is the value the session id is
 * checked against (see `decideCheckoutConfirmation`).
 */
export async function confirmCheckoutFromReturn(
  sessionId: string,
  accountId: string
): Promise<boolean> {
  let session = null;
  try {
    session = await createBillingFromEnv().retrieveCheckoutSession(sessionId);
  } catch (err) {
    console.error("confirmCheckoutFromReturn: provider read failed", err);
    return false;
  }

  const decision = decideCheckoutConfirmation(session, accountId);
  if (!decision.apply) {
    if (decision.reason === "wrong-account") {
      console.warn("confirmCheckoutFromReturn: refused a session from another workspace");
    }
    return false;
  }

  const snap = decision.snapshot;
  const { error } = await createServiceClient()
    .from("accounts")
    .update({
      plan: snap.plan,
      subscription_status: snap.subscriptionStatus,
      seats_purchased: snap.seatsPurchased,
      linkedin_accounts_purchased: snap.linkedinAccountsPurchased,
      current_period_end: snap.currentPeriodEnd,
      stripe_subscription_id: snap.stripeSubscriptionId,
      stripe_customer_id: snap.stripeCustomerId,
      outreach_paused: !isActive(snap.subscriptionStatus),
    })
    .eq("id", accountId);

  if (error) {
    console.error("confirmCheckoutFromReturn: snapshot write failed", error);
    return false;
  }
  return true;
}
