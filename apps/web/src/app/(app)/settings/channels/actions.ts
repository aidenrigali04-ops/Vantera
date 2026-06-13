"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { validateSenderAddress, validateProvisionCounts } from "./validation";

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

  if (!account.sender_address) {
    return {
      error: "Add your sender address first — every cold email must carry it.",
    };
  }

  let mailboxes: Awaited<ReturnType<ReturnType<typeof createEmailInfraFromEnv>["provision"]>>;
  try {
    mailboxes = await createEmailInfraFromEnv().provision({
      accountId: account.id,
      domainCount,
      mailboxesPerDomain,
    });
  } catch {
    return { error: "Could not start email setup. Try again shortly." };
  }

  const now = new Date().toISOString();
  const rows = mailboxes.map((m) => ({
    account_id: account.id,
    email_address: m.address,
    domain: m.domain,
    provider_ref: m.id,
    status: "warming" as const,
    warmup_started_at: now,
  }));

  const { error: insertError } = await supabase.from("mailboxes").insert(rows);
  if (insertError) return { error: "Could not start email setup. Try again shortly." };

  revalidatePath("/settings/channels");
  return { success: `Email sending set up — ${rows.length} mailbox${rows.length !== 1 ? "es" : ""} are now warming up.` };
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

  try {
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(account.id);
    return { url };
  } catch {
    return { error: "Could not generate a connection link. Try again shortly." };
  }
}
