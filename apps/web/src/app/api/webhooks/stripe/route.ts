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
      const { error } = await supabase
        .from("accounts")
        .update({
          plan: snap.plan,
          subscription_status: snap.subscriptionStatus,
          seats_purchased: snap.seatsPurchased,
          linkedin_accounts_purchased: snap.linkedinAccountsPurchased,
          current_period_end: snap.currentPeriodEnd,
          stripe_subscription_id: snap.stripeSubscriptionId,
          outreach_paused: snap.outreachPaused,
        })
        .eq("stripe_customer_id", snap.stripeCustomerId);
      if (error) throw new Error(`account snapshot update failed: ${error.code}`);
    },
  });

  return new Response(result.body, { status: result.status });
}
