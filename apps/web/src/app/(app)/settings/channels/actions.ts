"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { buildConnectRedirects } from "./redirects";
import { gate, loadBillingRow } from "@/lib/billing/entitlement";
import { reconcileLinkedInAccounts } from "@/lib/linkedin/sync";

export type ChannelActionState = { error?: string; success?: string };

// ── Pause toggle ──────────────────────────────────────────────────────────────

export async function toggleSendingPause(
  _prev: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const paused = formData.get("paused") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("accounts")
    .update({ outreach_paused: paused })
    .eq("id", account.id);
  if (error) return { error: "Could not update sending state. Try again shortly." };

  revalidatePath("/settings/channels");
  return { success: paused ? "All sending paused." : "Sending resumed." };
}

// ── LinkedIn connect link ─────────────────────────────────────────────────────

export async function createLinkedInConnectLink(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { count: liCount } = await supabase
    .from("linkedin_accounts")
    .select("id", { count: "exact", head: true });
  const billingRow = await loadBillingRow(supabase);
  if (!billingRow) return { error: "No active plan. Choose a plan in Billing first." };
  const planGate = gate(billingRow, "linkedinAccount", liCount ?? 0);
  if (!planGate.ok) return { error: planGate.error };

  try {
    const redirects = buildConnectRedirects(process.env.APP_URL ?? "http://localhost:3000");
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(account.id, redirects);
    return { url };
  } catch (err) {
    // Surface the underlying provider error to runtime logs — the user-facing
    // message stays generic, but a bare catch here previously made connect
    // failures undiagnosable (no log line reached Vercel).
    console.error("createLinkedInConnectLink failed:", err);
    return { error: "Could not generate a connection link. Try again shortly." };
  }
}

/**
 * Reconcile connected LinkedIn accounts from the provider into linkedin_accounts
 * for the session's account. Backstops a missed hosted-auth status webhook so a
 * just-connected account shows as connected (rule 04). Account resolved via RLS.
 */
export async function refreshLinkedInAccounts(): Promise<{ error?: string; synced?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  try {
    const { synced } = await reconcileLinkedInAccounts(account.id);
    revalidatePath("/settings/channels");
    return { synced };
  } catch (err) {
    console.error("refreshLinkedInAccounts failed:", err);
    return { error: "Could not refresh LinkedIn status. Try again shortly." };
  }
}
