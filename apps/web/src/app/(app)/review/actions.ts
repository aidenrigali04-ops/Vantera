"use server";

import { revalidatePath } from "next/cache";
import { describeViolations, validateHumanity } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { normalizeSuppressionValue } from "@/lib/suppression";
import { parseDraftEdit } from "./validation";

export type ReviewActionState = { error?: string };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null };
  // account from the validated session via RLS-scoped select (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return { supabase, user, account };
}

export async function approveDraft(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", sendId)
    .eq("status", "pending_review"); // only queued drafts can be approved
  if (error) return { error: "Could not approve the draft. Only workspace admins can review." };
  revalidatePath("/review");
  return {};
}

export async function saveDraftEdit(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const parsed = parseDraftEdit(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { sendId, subject, body } = parsed.values;
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  // the humanizer verdict follows the text — edits re-lint, clean edits clear the flags
  const violations = validateHumanity([subject, body].filter(Boolean).join("\n"));
  const styleFlags = violations.length > 0 ? describeViolations(violations) : null;

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ subject, body, style_flags: styleFlags })
    .eq("id", sendId)
    .eq("status", "pending_review");
  if (error) return { error: "Could not save the edit. Only workspace admins can review." };
  revalidatePath("/review");
  return {};
}

export async function declineDraft(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ status: "canceled" })
    .eq("id", sendId)
    .eq("status", "pending_review");
  if (error) return { error: "Could not decline the draft. Only workspace admins can review." };
  revalidatePath("/review");
  return {};
}

export async function declineAndSuppress(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user, account } = await session();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  const { data: send } = await supabase
    .from("scheduled_sends")
    .select("id, channel, lead_id, leads(email, linkedin_url)")
    .eq("id", sendId)
    .maybeSingle<{
      id: string;
      channel: "email" | "linkedin";
      lead_id: string;
      leads: { email: string | null; linkedin_url: string | null } | null;
    }>();
  if (!send?.leads) return { error: "Draft not found." };

  const raw = send.channel === "email" ? send.leads.email : send.leads.linkedin_url;
  if (!raw) return { error: "This lead has no contact info to suppress." };
  const value = normalizeSuppressionValue(send.channel, raw);

  const { error: suppressError } = await supabase.from("suppression_entries").insert({
    account_id: account.id,
    kind: send.channel,
    value,
    source: "manual",
    note: "Declined from the review queue",
    lead_id: send.lead_id,
    created_by: user.id,
  });
  // 23505 = already suppressed; still cancel the drafts below
  if (suppressError && suppressError.code !== "23505") {
    return { error: "Could not suppress the contact. Only workspace admins can review." };
  }

  // rule 11: nothing for this contact stays queued on this channel
  await supabase
    .from("scheduled_sends")
    .update({ status: "suppressed" })
    .eq("lead_id", send.lead_id)
    .eq("channel", send.channel)
    .in("status", ["pending_review", "approved"]);

  revalidatePath("/review");
  revalidatePath("/settings/suppression");
  return {};
}
