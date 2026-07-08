"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  });
  if (error) return { error: "Could not queue your reply. Please try again." };
  revalidatePath("/leads");
  return { sent: true };
}

/**
 * Deferred (Non-Goal): the AI conversation handler. Surfaced so users discover
 * it, but it does not act yet.
 */
export async function delegateToAgent(_leadId: string): Promise<ReplyState> {
  return { error: "Agent reply handling is coming soon — respond yourself for now." };
}
