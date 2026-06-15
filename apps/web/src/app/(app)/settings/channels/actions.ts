"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { canProvision, validateSenderAddress, validateProvisionCounts } from "./validation";
import { buildConnectRedirects } from "./redirects";
import { gate, loadBillingRow } from "@/lib/billing/entitlement";

export type ChannelActionState = { error?: string; success?: string };

// ── Sender address ────────────────────────────────────────────────────────────

export async function saveSenderAddress(
  _prev: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const input: Record<string, unknown> = {
    line1: formData.get("line1") ?? "",
    line2: formData.get("line2") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    postal: formData.get("postal") ?? "",
    country: formData.get("country") ?? "",
  };

  const parsed = validateSenderAddress(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  // account always resolved from RLS-scoped select — never from the form (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("accounts")
    .update({ sender_address: parsed.values })
    .eq("id", account.id);
  if (error) return { error: "Could not save address. Try again shortly." };

  revalidatePath("/settings/channels");
  return { success: "Sender address saved." };
}

// ── Sender name ───────────────────────────────────────────────────────────────

export async function saveSenderName(
  _prev: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const raw = String(formData.get("sender_name") ?? "").trim();
  // Empty string → store null (clears the name; the email template strips the token).
  const value = raw.length > 0 ? raw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  // account always resolved from RLS-scoped select — never from the form (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("accounts")
    .update({ sender_name: value })
    .eq("id", account.id);
  if (error) return { error: "Could not save sender name. Try again shortly." };

  revalidatePath("/settings/channels");
  return { success: "Sender name saved." };
}

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

// ── Email provisioning ────────────────────────────────────────────────────────

export async function provisionEmailSending(
  _prev: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const { domainCount, mailboxesPerDomain } = validateProvisionCounts(
    String(formData.get("domainCount") ?? "1"),
    String(formData.get("mailboxesPerDomain") ?? "1")
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, sender_address")
    .limit(1)
    .maybeSingle<{ id: string; sender_address: unknown }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { count: existingCount } = await supabase
    .from("mailboxes")
    .select("id", { count: "exact", head: true });
  const provisionGate = canProvision(account.sender_address, existingCount ?? 0);
  if (!provisionGate.ok) return { error: provisionGate.error };

  const billingRow = await loadBillingRow(supabase);
  if (!billingRow) return { error: "No active plan. Choose a plan in Billing first." };
  const planGate = gate(billingRow, "mailbox", existingCount ?? 0);
  if (!planGate.ok) return { error: planGate.error };

  try {
    await tasks.trigger("provision-email", {
      accountId: account.id,
      domainCount,
      mailboxesPerDomain,
    });
  } catch {
    return { error: "Could not start email setup. Try again shortly." };
  }

  revalidatePath("/settings/channels");
  return { success: "Email setup started — your mailboxes will appear here as they finish provisioning and begin warming up." };
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
  } catch {
    return { error: "Could not generate a connection link. Try again shortly." };
  }
}
