"use server";

import { revalidatePath } from "next/cache";
import {
  CONNECTION_NOTE_MAX_CHARS,
  FOLLOWUP_MAX_CHARS,
  FOLLOWUP_MAX_WORDS,
  STEER_MAX_CHARS,
  describeViolations,
  fixDraftText,
  regenerateLinkedInStage,
  validateHumanity,
} from "@vantera/agent-brains";
import { getModel } from "@vantera/ai";
import { createClient } from "@/lib/supabase/server";
import { buildFirstTouchDraftInput } from "@/lib/copy/first-touch-input";
import { normalizeSuppressionValue } from "@/lib/suppression";
import { parseDraftEdit } from "./validation";

export type ReviewActionState = {
  error?: string;
  notice?: string;
  /** saveDraftEdit: what was actually written, so the caller shows the saved text + re-linted flags */
  body?: string;
  styleFlags?: string | null;
};

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

  const { data, error } = await supabase
    .from("scheduled_sends")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", sendId)
    .eq("status", "pending_review") // only queued drafts can be approved
    .select("id");
  if (error) return { error: "Could not approve the draft. Only workspace admins can review." };
  // 0 rows = already handled or RLS hid it — never report an approval that didn't land.
  if (!data || data.length === 0) return { error: "That draft was already handled." };
  revalidatePath("/approvals");
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
  revalidatePath("/approvals");
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

  const { data, error } = await supabase
    .from("scheduled_sends")
    .update({ subject, body, style_flags: styleFlags })
    .eq("id", sendId)
    .eq("status", "pending_review")
    .select("id");
  if (error) return { error: "Could not save the edit. Only workspace admins can review." };
  // 0 rows = no longer pending (sent/approved/canceled) or RLS hid it — never report a save that didn't land.
  if (!data || data.length === 0) return { error: "That draft was already handled." };
  revalidatePath("/approvals");
  revalidatePath("/today");
  revalidatePath("/prospects");
  return { body, styleFlags };
}

/**
 * The Approvals queue's "Fix" button: one targeted AI edit of a style-flagged draft. The fixed body is
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

  const { data: written, error } = await supabase
    .from("scheduled_sends")
    .update({ body: fixed.text, style_flags: styleFlags })
    .eq("id", sendId)
    .eq("status", "pending_review")
    .select("id");
  if (error) return { error: "Could not save the fix. Only workspace admins can review." };
  if (!written || written.length === 0) return { error: "That draft was already handled." };
  revalidatePath("/approvals");
  revalidatePath("/today");
  revalidatePath("/prospects");
  return styleFlags
    ? {
        body: fixed.text,
        styleFlags,
        notice: "Cleaned up what it could — a flag still remains, so give the copy a quick read.",
      }
    : { body: fixed.text, styleFlags: null };
}

export type RegenerateResult = { body?: string; styleFlags?: string | null; error?: string };

/** The AI call failed. Logged server-side so a broken key or outage shows in runtime logs. */
function logRegenerateFailure(sendId: string, err: unknown): void {
  const e = err as { name?: string; message?: string; statusCode?: number };
  console.error("regenerateDraft: draft failed", { sendId, name: e?.name, statusCode: e?.statusCode, message: e?.message });
}

/**
 * Regenerate a queued FIRST-TOUCH draft, optionally steered by a short owner note (prompt-only —
 * the brain never lets it add facts). The new text goes through the same humanizer; its verdict
 * is written as the draft's flags. The draft stays pending_review.
 */
export async function regenerateDraft(sendId: string, steer: string): Promise<RegenerateResult> {
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: send } = await supabase
    .from("scheduled_sends")
    .select("id, lead_id, linkedin_stage, origin, status")
    .eq("id", sendId)
    .eq("status", "pending_review")
    .maybeSingle<{
      id: string;
      lead_id: string;
      linkedin_stage: "invite" | "message" | null;
      origin: string | null;
      status: string;
    }>();
  if (!send) return { error: "That draft was already handled." };
  if (send.origin !== "sequence") return { error: "Regenerate works on first-touch drafts only." };

  const input = await buildFirstTouchDraftInput(supabase, send.lead_id);
  if (!input) return { error: "Couldn't load this prospect's context." };

  const note = steer.trim().slice(0, STEER_MAX_CHARS);
  let result: Awaited<ReturnType<typeof regenerateLinkedInStage>>;
  try {
    result = await regenerateLinkedInStage(
      input,
      send.linkedin_stage === "invite" ? "invite" : "message",
      note || null,
      getModel()
    );
  } catch (err) {
    logRegenerateFailure(sendId, err);
    return { error: "Couldn't regenerate right now. Try again." };
  }
  const styleFlags = describeViolations(result.violations) ?? null;

  const { data, error } = await supabase
    .from("scheduled_sends")
    .update({ body: result.text, style_flags: styleFlags })
    .eq("id", sendId)
    .eq("status", "pending_review")
    .select("id");
  if (error) return { error: "Could not save the new draft. Only workspace admins can review." };
  if (!data || data.length === 0) return { error: "That draft was already handled." };
  revalidatePath("/approvals");
  revalidatePath("/today");
  revalidatePath("/prospects");
  return { body: result.text, styleFlags };
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
  if (!raw) return { error: "This prospect has no contact info to suppress." };
  const value = normalizeSuppressionValue(send.channel, raw);

  const { error: suppressError } = await supabase.from("suppression_entries").insert({
    account_id: account.id,
    kind: send.channel,
    value,
    source: "manual",
    note: "Declined from Approvals",
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

  revalidatePath("/approvals");
  revalidatePath("/settings/suppression");
  return {};
}
