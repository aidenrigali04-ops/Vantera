"use server";

import { revalidatePath } from "next/cache";
import {
  CONNECTION_NOTE_MAX_CHARS,
  FOLLOWUP_MAX_CHARS,
  FOLLOWUP_MAX_WORDS,
  describeViolations,
  fixDraftText,
  validateHumanity,
} from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { normalizeSuppressionValue } from "@/lib/suppression";
import { parseDraftEdit } from "./validation";

export type ReviewActionState = { error?: string; notice?: string };

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

/**
 * P1 bulk approve (2026-07-15): approve every CLEAN pending draft in one click. Style-flagged
 * drafts are deliberately excluded — flagged copy always gets human eyes (rule 06/11).
 */
export async function approveAllClean(
  _prev: ReviewActionState,
  _formData: FormData
): Promise<ReviewActionState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data, error } = await supabase
    .from("scheduled_sends")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("status", "pending_review")
    .is("style_flags", null)
    .select("id");
  if (error) return { error: "Could not bulk-approve. Only workspace admins can review." };
  const n = (data ?? []).length;
  revalidatePath("/review");
  return n === 0
    ? { error: "Nothing clean to approve — the remaining drafts are style-flagged and need your eyes." }
    : {};
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

/**
 * The review queue's "Fix" button: one targeted AI edit of a style-flagged draft. The fixed body is
 * re-linted (same humanizer bar, at the stage's send cap) before it's saved — flags that survive the
 * fix stay visible on the card, so the fix can never quietly dodge the style check. The draft stays
 * in pending_review either way; the owner still approves the send.
 */
export async function fixDraft(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const sendId = String(formData.get("sendId") ?? "");
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: send } = await supabase
    .from("scheduled_sends")
    .select("id, body, style_flags, linkedin_stage")
    .eq("id", sendId)
    .eq("status", "pending_review")
    .maybeSingle<{
      id: string;
      body: string;
      style_flags: string | null;
      linkedin_stage: "invite" | "message" | null;
    }>();
  if (!send) return { error: "Draft not found." };
  if (!send.style_flags) return {}; // nothing flagged — nothing to fix

  const isInvite = send.linkedin_stage === "invite";
  let fixed: Awaited<ReturnType<typeof fixDraftText>>;
  try {
    fixed = await fixDraftText({
      text: send.body,
      flags: send.style_flags,
      // invite = LinkedIn's connection-note cap; everything else the follow-up cap (the strictest
      // message-stage limit, so a fixed body is valid at every send boundary)
      maxChars: isInvite ? CONNECTION_NOTE_MAX_CHARS : FOLLOWUP_MAX_CHARS,
      maxWords: isInvite ? undefined : FOLLOWUP_MAX_WORDS,
      // links are always banned on an invite; elsewhere only when the original flag was about one
      banLinks: isInvite || /link/i.test(send.style_flags),
    });
  } catch {
    return { error: "The fix pass didn't complete — try again, or edit the draft manually." };
  }
  const styleFlags = fixed.violations.length > 0 ? describeViolations(fixed.violations) : null;

  const { error } = await supabase
    .from("scheduled_sends")
    .update({ body: fixed.text, style_flags: styleFlags })
    .eq("id", sendId)
    .eq("status", "pending_review");
  if (error) return { error: "Could not save the fix. Only workspace admins can review." };
  revalidatePath("/review");
  return styleFlags
    ? { notice: "Cleaned up what it could — a flag still remains, so give the copy a quick read." }
    : {};
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
