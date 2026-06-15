"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBillingFromEnv, type PlanTier } from "@vantera/billing";

function appUrl(path: string): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
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
    .select("id, stripe_customer_id")
    .limit(1)
    .maybeSingle<{ id: string; stripe_customer_id: string | null }>();
  if (!account) redirect("/login");

  const { url } = await createBillingFromEnv().createCheckoutSession({
    accountId: account.id,
    stripeCustomerId: account.stripe_customer_id,
    customerEmail: user.email ?? "",
    tier,
    interval,
    seatAddons,
    linkedinAddons,
    successUrl: appUrl("/settings/billing?checkout=success"),
    cancelUrl: appUrl("/settings/billing?checkout=cancel"),
  });
  redirect(url);
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
