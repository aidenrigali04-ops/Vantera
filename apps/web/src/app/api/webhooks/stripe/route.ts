import { createBillingFromEnv } from "@vantera/billing";
import { createServiceClient } from "@/lib/supabase/service";
import { handleStripeWebhook } from "@/server/billing-webhook";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const supabase = createServiceClient();

  const result = await handleStripeWebhook(rawBody, signature, {
    provider: createBillingFromEnv(),
    recordEvent: async (providerEventId, payload) => {
      const { error } = await supabase
        .from("webhook_events")
        .insert({ source: "stripe", provider_event_id: providerEventId, payload });
      if (error) {
        if (error.code === "23505") return false; // duplicate
        throw new Error(`webhook event store failed: ${error.code}`);
      }
      return true;
    },
    applySnapshot: async (snap) => {
      const updateCols = {
        plan: snap.plan,
        subscription_status: snap.subscriptionStatus,
        seats_purchased: snap.seatsPurchased,
        linkedin_accounts_purchased: snap.linkedinAccountsPurchased,
        current_period_end: snap.currentPeriodEnd,
        stripe_subscription_id: snap.stripeSubscriptionId,
        stripe_customer_id: snap.stripeCustomerId,
        outreach_paused: snap.outreachPaused,
      };
      // Primary match: existing customer id.
      const { data: byCustomer } = await supabase
        .from("accounts")
        .update(updateCols)
        .eq("stripe_customer_id", snap.stripeCustomerId)
        .select("id");
      if ((byCustomer?.length ?? 0) > 0) return;
      // First subscription: the row has no customer id yet — link by account id from metadata.
      if (snap.accountId) {
        const { error } = await supabase
          .from("accounts")
          .update(updateCols)
          .eq("id", snap.accountId);
        if (error) throw new Error(`account snapshot link failed: ${error.code}`);
        return;
      }
      // Nothing matched and no account id to fall back on — surface for retry.
      throw new Error("billing webhook: no account matched for snapshot");
    },
  });

  return new Response(result.body, { status: result.status });
}
