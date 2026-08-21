"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBillingFromEnv, TRIAL_DAYS, type PlanTier } from "@vantera/billing";

function appUrl(path: string): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}

/**
 * Where Checkout sends the user back. A closed whitelist (never a raw URL from the form):
 * onboarding's subscription step returns to /onboarding so the flow can finish provisioning;
 * everything else returns to billing settings.
 */
function returnPath(formData: FormData): string {
  return String(formData.get("returnTo") ?? "") === "onboarding" ? "/onboarding" : "/settings/billing";
}

export async function startCheckout(formData: FormData): Promise<void> {
  const tier = String(formData.get("tier") ?? "") as PlanTier;
  const interval = String(formData.get("interval") ?? "month") === "year" ? "year" : "month";
  const seatAddons = Math.max(0, parseInt(String(formData.get("seatAddons") ?? "0"), 10) || 0);
  const linkedinAddons = Math.max(0, parseInt(String(formData.get("linkedinAddons") ?? "0"), 10) || 0);
  if (!["starter", "growth", "scale"].includes(tier)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, stripe_customer_id, stripe_subscription_id")
    .limit(1)
    .maybeSingle<{ id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }>();
  if (!account) redirect("/login");

  const back = returnPath(formData);
  // A provider misconfiguration or outage must not throw out of a server action — that
  // surfaces as a 500 / client crash mid-signup. Fail back to the page with a message.
  const url = await createCheckoutUrl({
    accountId: account.id,
    stripeCustomerId: account.stripe_customer_id,
    customerEmail: user.email ?? "",
    tier,
    interval,
    seatAddons,
    linkedinAddons,
    successUrl: appUrl(`${back}?checkout=success`),
    cancelUrl: appUrl(`${back}?checkout=cancel`),
    // First subscription on this workspace → card-required trial. A workspace that has
    // already held a subscription (lapsed, canceled, switching) pays from day one.
    trialPeriodDays: account.stripe_subscription_id ? undefined : TRIAL_DAYS,
  });
  if (!url) redirect(`${back}?checkout=error`);
  redirect(url);
}

/** Create the hosted checkout session, or null when the provider is unavailable. */
async function createCheckoutUrl(
  req: Parameters<ReturnType<typeof createBillingFromEnv>["createCheckoutSession"]>[0]
): Promise<string | null> {
  try {
    const { url } = await createBillingFromEnv().createCheckoutSession(req);
    return url;
  } catch (err) {
    console.error("startCheckout: could not create a checkout session:", err);
    return null;
  }
}

export async function openBillingPortal(): Promise<void> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (!account?.stripe_customer_id) redirect("/settings/billing?portal=unavailable");

  const { url } = await createBillingFromEnv().createPortalSession({
    stripeCustomerId: account.stripe_customer_id,
    returnUrl: appUrl("/settings/billing"),
  });
  redirect(url);
}
