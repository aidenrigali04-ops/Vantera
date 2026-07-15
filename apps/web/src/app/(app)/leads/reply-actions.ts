"use server";

import { revalidatePath } from "next/cache";
import { draftConversationMessage, type ConversationMessageInput, type ProofPoint, type StoredInsights } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadThread } from "@/lib/conversations";

export type ReplyState = { error?: string; sent?: boolean };
export type DraftState = { error?: string; message?: string; flagged?: boolean };

/**
 * Assemble the responder brain's grounding from RLS-scoped reads — the web-side twin of the
 * jobs pipeline's getResponderBundle (L2 cockpit). Null when the lead can't ground a reply.
 */
async function buildConversationInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string
): Promise<ConversationMessageInput | null> {
  const [{ data: lead }, { data: agent }, { data: account }, { data: proof }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, title, company_name, industry, ai_insights")
      .eq("id", leadId)
      .maybeSingle<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        title: string | null;
        company_name: string | null;
        industry: string | null;
        ai_insights: StoredInsights | null;
      }>(),
    supabase
      .from("agents")
      .select("config")
      .eq("kind", "copy")
      .eq("status", "live")
      .limit(1)
      .maybeSingle<{ config: { cta?: string; bookingUrl?: string | null; websiteUrl?: string | null } | null }>(),
    supabase
      .from("accounts")
      .select("name, onboarding_industry, website_scan")
      .limit(1)
      .maybeSingle<{ name: string | null; onboarding_industry: string | null; website_scan: { summary?: string } | null }>(),
    supabase
      .from("proof_points")
      .select("kind, text, question")
      .returns<ProofPoint[]>(),
  ]);
  if (!lead?.ai_insights) return null;

  const turns = await loadThread(supabase, leadId);
  const last = turns[turns.length - 1];
  const incoming = last?.role === "lead" ? last.text : undefined;

  return {
    lead: {
      firstName: lead.first_name,
      lastName: lead.last_name,
      title: lead.title,
      companyName: lead.company_name,
      industry: lead.industry,
    },
    insights: lead.ai_insights,
    context: {
      cta: agent?.config?.cta ?? "a quick look",
      bookingUrl: agent?.config?.bookingUrl ?? null,
      websiteUrl: agent?.config?.websiteUrl ?? null,
      accountName: account?.name ?? null,
      accountIndustry: account?.onboarding_industry ?? null,
      valueProp: account?.website_scan?.summary ?? null,
      proofPoints: proof ?? [],
    },
    thread: turns
      .filter((t) => !(incoming && t === last))
      .map((t) => ({ role: t.role, text: t.text })),
    incoming,
  };
}

/**
 * "Draft with Vera" (L2): the responder brain writes the next message for THIS thread and
 * hands it to the composer — the human edits and sends. Nothing is queued here.
 */
export async function draftWithVera(leadId: string): Promise<DraftState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const input = await buildConversationInput(supabase, leadId);
  if (!input) return { error: "This lead doesn't have enough context for a draft yet." };
  try {
    const draft = await draftConversationMessage(input);
    return { message: draft.message, flagged: draft.violations.length > 0 };
  } catch {
    return { error: "Drafting hit a snag — try again in a moment." };
  }
}

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

  let { data: send } = await supabase
    .from("scheduled_sends")
    .select("account_id, campaign_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!send) {
    // L2 compose-to-any-lead: no prior send → ride the live Outreach agent's campaign.
    const { data: agent } = await supabase
      .from("agents")
      .select("account_id, campaign_id")
      .eq("kind", "copy")
      .eq("status", "live")
      .limit(1)
      .maybeSingle<{ account_id: string; campaign_id: string | null }>();
    if (!agent?.campaign_id) return { error: "Deploy your Outreach agent first." };
    send = { account_id: agent.account_id, campaign_id: agent.campaign_id };
  }

  // Rule 11: suppression is checked before anything that could reach a prospect — manual
  // sends included (dispatch re-checks at the send boundary; this keeps the queue clean).
  const { data: leadRow } = await supabase
    .from("leads")
    .select("linkedin_url")
    .eq("id", leadId)
    .maybeSingle<{ linkedin_url: string | null }>();
  if (leadRow?.linkedin_url) {
    const normalized = leadRow.linkedin_url.trim().toLowerCase().replace(/\/+$/, "");
    const { data: suppressed } = await supabase
      .from("suppression_entries")
      .select("id")
      .eq("kind", "linkedin")
      .eq("value", normalized)
      .limit(1)
      .maybeSingle();
    if (suppressed) return { error: "This prospect opted out — messaging them again isn't allowed." };
  }

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
 * "Let agent handle" (L2, un-stubbed): Vera takes the thread back — automation resumes and
 * the responder drafts the next message NOW, queued through the normal send path. Review-mode
 * campaigns (and any style-flagged draft) land in the review queue; automatic sends clean.
 */
export async function delegateToAgent(leadId: string): Promise<ReplyState> {
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
    .maybeSingle<{ account_id: string; campaign_id: string }>();
  if (!send) return { error: "This lead isn't in a campaign yet." };
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("send_mode")
    .eq("id", send.campaign_id)
    .maybeSingle<{ send_mode: string }>();

  const input = await buildConversationInput(supabase, leadId);
  if (!input) return { error: "This lead doesn't have enough context for Vera to take over." };

  let draft: Awaited<ReturnType<typeof draftConversationMessage>>;
  try {
    draft = await draftConversationMessage(input);
  } catch {
    return { error: "Vera couldn't draft right now — try again in a moment." };
  }
  const clean = draft.violations.length === 0;
  const autoSend = campaign?.send_mode === "automatic" && clean;

  const { error } = await supabase.from("scheduled_sends").insert({
    account_id: send.account_id,
    campaign_id: send.campaign_id,
    lead_id: leadId,
    channel: "linkedin",
    body: draft.message,
    status: autoSend ? "approved" : "pending_review",
    linkedin_stage: "message",
    origin: "reply_response",
  });
  if (error) return { error: "Couldn't queue Vera's reply. Try again shortly." };

  // Hand the thread back to automation (paused_reply → active) so follow-ups resume too.
  const admin = createServiceClient();
  await admin
    .from("sequence_runs")
    .update({ status: "active", next_action_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("status", "paused_reply");

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/inbox");
  return { sent: true };
}
