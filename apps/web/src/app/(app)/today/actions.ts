"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Today's own server actions. Every write resolves the user from the validated session and
 * the account through RLS (rule 02) — no ids from the client except the row being acted on,
 * which RLS scopes to the caller's workspace anyway.
 */

export type RejectReason = "wrong_person" | "bad_timing" | "weak_message" | "other";
const REJECT_REASONS: ReadonlySet<string> = new Set(["wrong_person", "bad_timing", "weak_message", "other"]);

const DISMISSIBLE: ReadonlySet<string> = new Set(["playbook_suggestion", "style_memory", "crm_handoff", "calendar_link"]);

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Dismiss a one-time ask (P3/P4 tile). Stored as {kind: iso} on the user's own profile row. */
export async function dismissAsk(kind: string): Promise<{ error?: string }> {
  if (!DISMISSIBLE.has(kind)) return { error: "Invalid request." };
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: prof } = await supabase
    .from("user_profiles")
    .select("dismissed_asks")
    .eq("user_id", user.id)
    .maybeSingle<{ dismissed_asks: Record<string, string> | null }>();
  const next = { ...(prof?.dismissed_asks ?? {}), [kind]: new Date().toISOString() };
  const { error } = await supabase.from("user_profiles").upsert({ user_id: user.id, dismissed_asks: next });
  if (error) return { error: "Could not dismiss that. Please try again." };
  revalidatePath("/today");
  return {};
}

/**
 * Stamp the visit — the next render's "Since {time}" sentence reads from this. Called after
 * the page has rendered (a fire-and-forget from a client effect), never during render.
 */
export async function markTodayViewed(): Promise<void> {
  const { supabase, user } = await sessionUser();
  if (!user) return;
  const now = new Date().toISOString();
  const { data: prof } = await supabase
    .from("user_profiles")
    .select("first_session_done_at")
    .eq("user_id", user.id)
    .maybeSingle<{ first_session_done_at: string | null }>();
  // Reaching Today at all means the first approval session is behind this user (the page
  // forwards to the queue until then), so stamp the flag on the way past — one write, and
  // the redirect never has to re-derive it from history again.
  await supabase.from("user_profiles").upsert({
    user_id: user.id,
    last_today_viewed_at: now,
    ...(prof?.first_session_done_at ? {} : { first_session_done_at: now }),
  });
}

/**
 * The first approval session is over (queue cleared or the user left the queue) — from now
 * on /today is the home (blueprint §8 "First session").
 */
export async function markFirstSessionDone(): Promise<void> {
  const { supabase, user } = await sessionUser();
  if (!user) return;
  const { data: prof } = await supabase
    .from("user_profiles")
    .select("first_session_done_at")
    .eq("user_id", user.id)
    .maybeSingle<{ first_session_done_at: string | null }>();
  if (prof?.first_session_done_at) return;
  await supabase.from("user_profiles").upsert({ user_id: user.id, first_session_done_at: new Date().toISOString() });
}

/**
 * Inline reject from the Today queue: the draft is canceled with a reason (0064) so the
 * rejection learning loop can read patterns later. Only queued drafts can be rejected; the
 * same admin-only RLS policy the review queue uses authorizes the write.
 */
export async function rejectDraftWithReason(sendId: string, reason: RejectReason): Promise<{ error?: string }> {
  if (!sendId || !REJECT_REASONS.has(reason)) return { error: "Invalid request." };
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data, error } = await supabase
    .from("scheduled_sends")
    .update({ status: "canceled", rejection_reason: reason })
    .eq("id", sendId)
    .eq("status", "pending_review")
    .select("id");
  if (error) return { error: "Could not reject the draft. Only workspace admins can review." };
  if (!data || data.length === 0) return { error: "That draft was already handled." };
  revalidatePath("/today");
  revalidatePath("/approvals");
  return {};
}

/** Undo an inline reject within the toast window: back to the queue, reason cleared. */
export async function undoRejectDraft(sendId: string): Promise<{ error?: string }> {
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { error } = await supabase
    .from("scheduled_sends")
    .update({ status: "pending_review", rejection_reason: null })
    .eq("id", sendId)
    .eq("status", "canceled")
    .not("rejection_reason", "is", null);
  if (error) return { error: "Could not restore the draft." };
  revalidatePath("/today");
  revalidatePath("/approvals");
  return {};
}

/** Approve from the peek: the review queue's own transition, revalidating Today too. */
export async function approveFromToday(sendId: string): Promise<{ error?: string }> {
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { data, error } = await supabase
    .from("scheduled_sends")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", sendId)
    .eq("status", "pending_review")
    .select("id");
  if (error) return { error: "Could not approve the draft. Only workspace admins can review." };
  if (!data || data.length === 0) return { error: "That draft was already handled." };
  revalidatePath("/today");
  revalidatePath("/approvals");
  return {};
}

/** Undo an approve within the toast window (the scheduler has not picked it up yet). */
export async function undoApproveDraft(sendId: string): Promise<{ error?: string }> {
  if (!sendId) return { error: "Invalid request." };
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { error } = await supabase
    .from("scheduled_sends")
    .update({ status: "pending_review", approved_by: null, approved_at: null })
    .eq("id", sendId)
    .eq("status", "approved");
  if (error) return { error: "Could not undo — it may already be scheduled." };
  revalidatePath("/today");
  revalidatePath("/approvals");
  return {};
}
