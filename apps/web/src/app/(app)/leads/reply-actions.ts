"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ReplyState = { error?: string; sent?: boolean };

/**
 * Queue a human-written reply on the lead's channel via the existing send path
 * (an approved scheduled_send the dispatcher picks up). account/campaign come
 * from the lead's most recent send — never the client (rule 02).
 */
export async function sendManualReply(
  leadId: string,
  channel: "email" | "linkedin",
  body: string
): Promise<ReplyState> {
  if (!body.trim()) return { error: "Write a message first." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: send } = await supabase
    .from("scheduled_sends")
    .select("account_id, campaign_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!send) return { error: "This lead isn't in a campaign yet." };

  const trimmed = body.trim();

  // Double-submit guard: delivery happens minutes after this returns, so an impatient resubmit
  // of the same text used to queue a real second message (a prospect got the identical reply
  // twice, 2 minutes apart, 2026-07-07). Same text already queued = this message; already
  // delivered = tell the user instead of silently re-sending.
  const { data: duplicate } = await supabase
    .from("scheduled_sends")
    .select("id, status")
    .eq("lead_id", leadId)
    .eq("body", trimmed)
    .in("status", ["pending_review", "approved", "scheduled", "sending", "sent"])
    .limit(1)
    .maybeSingle();
  if (duplicate) {
    return duplicate.status === "sent"
      ? { error: "This exact message was already sent to this lead." }
      : { sent: true }; // already queued — sending it is in progress
  }

  const { error } = await supabase.from("scheduled_sends").insert({
    account_id: send.account_id,
    campaign_id: send.campaign_id,
    lead_id: leadId,
    channel,
    body: trimmed,
    status: "approved",
    linkedin_stage: channel === "linkedin" ? "message" : null,
    origin: "manual", // human-typed: exempt from the proactive send window, normal pacing otherwise
  });
  if (error) return { error: "Could not queue your reply. Please try again." };

  // Human takeover. The user is now driving this thread, so the agent stands down: it must never
  // message on top of a human reply (the "bot re-pitched after I answered" failure — Mohamed K,
  // 2026-07-05). Two writes via the service role (sequence_runs has no client write policy, and
  // scheduled_sends cancel isn't a client op) — safe because `send` above already proved, under
  // RLS, that this lead belongs to the caller's account:
  //   1. cancel the agent's queued/scheduled drafts (NEVER the user's own manual sends), and
  //   2. pause the lead's active sequence run so no proactive nudge fires.
  // Automation resumes only when the user explicitly calls resumeAutomation.
  const admin = createServiceClient();
  await admin
    .from("scheduled_sends")
    .update({ status: "canceled", error: "human took over the thread" })
    .eq("lead_id", leadId)
    .in("status", ["pending_review", "approved", "scheduled"])
    .neq("origin", "manual");
  await admin
    .from("sequence_runs")
    .update({ status: "paused_reply" })
    .eq("lead_id", leadId)
    // active OR exhausted: an engaged lead whose cold sequence already ran out can still be
    // re-engaged by the responder on their next reply — pausing both makes the takeover total.
    // 'converted' (won) and 'stopped' (hard-negative) are left as-is.
    .in("status", ["active", "exhausted"]);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`); // the brief shows the queued reply on next load
  return { sent: true };
}

/**
 * Hand the thread back to automation after a human takeover. Flips the lead's paused_reply run
 * back to active from now, so the Outreach agent may follow up / respond again. Ownership is
 * enforced by the RLS read (the lead resolves only if it belongs to the caller's account);
 * the state write then goes through the service role, since sequence_runs has no client policy.
 */
export async function resumeAutomation(leadId: string): Promise<ReplyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: owned } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle();
  if (!owned) return { error: "Lead not found." };

  const admin = createServiceClient();
  await admin
    .from("sequence_runs")
    .update({ status: "active", next_action_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("status", "paused_reply");

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { sent: true };
}

/**
 * Deferred (Non-Goal): the AI conversation handler. Surfaced so users discover
 * it, but it does not act yet.
 */
export async function delegateToAgent(_leadId: string): Promise<ReplyState> {
  return { error: "Agent reply handling is coming soon — respond yourself for now." };
}
