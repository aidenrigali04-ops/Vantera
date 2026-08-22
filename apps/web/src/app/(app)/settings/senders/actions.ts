"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLinkedInInfraFromEnv, isLinkedInInfraConfigured } from "@vantera/linkedin-infra";
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
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not update sending. Only workspace admins can pause or resume it." };

  revalidatePath("/settings/senders");
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

  if (process.env.NODE_ENV === "development" && !isLinkedInInfraConfigured()) {
    return {
      error:
        "LinkedIn isn't configured in this local environment — fill the LinkedIn section of .env.example into apps/web/.env.local and restart the dev server.",
    };
  }

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
 * Reconnect an EXISTING LinkedIn connection in place — same provider account, same
 * billable seat, same row (lead assignments survive). This is the expired-session flow;
 * plain connect would mint a duplicate seat (the 2026-07-08 triple-seat incident).
 * Ownership proof: the row must be visible through the session's RLS scope.
 */
export async function createLinkedInReconnectLink(
  rowId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: row } = await supabase
    .from("linkedin_accounts")
    .select("id, account_id, provider_ref")
    .eq("id", rowId)
    .maybeSingle<{ id: string; account_id: string; provider_ref: string }>();
  if (!row) return { error: "That LinkedIn account is no longer connected here." };

  try {
    const redirects = buildConnectRedirects(process.env.APP_URL ?? "http://localhost:3000");
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(
      row.account_id,
      redirects,
      { providerRef: row.provider_ref }
    );
    return { url };
  } catch (err) {
    console.error("createLinkedInReconnectLink failed:", err);
    return { error: "Could not generate a reconnection link. Try again shortly." };
  }
}

/**
 * Remove a connected LinkedIn account entirely: disconnect it at the provider (the seat
 * stops billing) and delete the row. Lead/send references null out via FK (history rows
 * survive); affected leads simply get re-assigned a sender on their next dispatch.
 * Ownership proof: the row must be visible through the session's RLS scope; the delete
 * itself runs service-role (linkedin_accounts writes are server-owned).
 */
export async function removeLinkedInAccount(rowId: string): Promise<ChannelActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: row } = await supabase
    .from("linkedin_accounts")
    .select("id, provider_ref")
    .eq("id", rowId)
    .maybeSingle<{ id: string; provider_ref: string }>();
  if (!row) return { error: "That LinkedIn account is no longer connected here." };

  try {
    await createLinkedInInfraFromEnv().deleteConnectedAccount(row.provider_ref);
  } catch (err) {
    // Best-effort: the provider may already have dropped it; the health sweep retries.
    console.error("removeLinkedInAccount provider delete failed:", err);
  }

  const svc = createServiceClient();
  const { error } = await svc.from("linkedin_accounts").delete().eq("id", row.id);
  if (error) return { error: "Could not remove the account. Try again shortly." };

  revalidatePath("/settings/senders");
  return { success: "LinkedIn account removed." };
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
    revalidatePath("/settings/senders");
    return { synced };
  } catch (err) {
    console.error("refreshLinkedInAccounts failed:", err);
    return { error: "Could not refresh LinkedIn status. Try again shortly." };
  }
}
